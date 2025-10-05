from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from typing import List, Optional
import xml.etree.ElementTree as ET
import requests
import glob
import os
import numpy as np
from skyfield.api import wgs84, load, utc
from pytz import timezone as pytz_timezone, UTC

app = FastAPI(title="Dynamic ISS Visible Pass API", version="1.3")

class SightingPass(BaseModel):
    country: str
    region: Optional[str]
    city: str
    spacecraft: str
    sighting_date: str
    duration_minutes: int
    max_elevation: int
    enters: str
    exits: str
    utc_offset: float
    utc_time: str
    utc_date: str

class NextPass(BaseModel):
    enters: str
    max_elevation: float
    exits: Optional[str]
    duration_seconds: float
    observer_lat: float
    observer_lon: float

class ISSLocation(BaseModel):
    timestamp_utc: str
    latitude: float
    longitude: float
    altitude_km: float

origins = [
    "http://localhost:5173",  # React dev server
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # allow your frontend
    allow_credentials=True,
    allow_methods=["*"],        # allow GET, POST, etc.
    allow_headers=["*"],        # allow custom headers
)

ts = load.timescale()
tle_url = "https://celestrak.org/NORAD/elements/stations.txt"
satellites = load.tle_file(tle_url)
iss = [s for s in satellites if "ISS" in s.name][0]

OEM_FILE = "ISS.OEM_J2K_EPH.xml"

def parse_oem_xml(file_path):
    tree = ET.parse(file_path)
    root = tree.getroot()
    vectors = []
    for sv in root.findall(".//stateVector"):
        epoch = sv.find("EPOCH").text
        x = float(sv.find("X").text)
        y = float(sv.find("Y").text)
        z = float(sv.find("Z").text)
        xd = float(sv.find("X_DOT").text)
        yd = float(sv.find("Y_DOT").text)
        zd = float(sv.find("Z_DOT").text)
        vectors.append({"epoch": epoch, "pos": (x, y, z), "vel": (xd, yd, zd)})
    return vectors

STATE_VECTORS = parse_oem_xml(OEM_FILE)

def oem_to_arrays(state_vectors):
    ts = load.timescale()
    times, positions, velocities = [], [], []
    for sv in state_vectors:
        # Ensure datetime is timezone-aware (UTC)
        dt = datetime.strptime(sv['epoch'], "%Y-%jT%H:%M:%S.%fZ").replace(tzinfo=utc)
        times.append(ts.utc(dt))
        positions.append(sv['pos'])
        velocities.append(sv['vel'])
    positions = np.array(positions) * 1000  # Convert km to meters
    velocities = np.array(velocities) * 1000
    return ts, times, positions, velocities

TS, TIMES, POS, VEL = oem_to_arrays(STATE_VECTORS)

def safe_int(value):
    if value is None:
        return 0
    value = value.strip()
    if value.startswith("<"):
        return 0
    try:
        return int(value)
    except ValueError:
        return 0

def safe_float(value):
    if value is None:
        return 0.0
    value = value.strip()
    try:
        return float(value)
    except ValueError:
        return 0.0

def parse_xml_file(file_path):
    tree = ET.parse(file_path)
    root = tree.getroot()
    passes = []
    for vp in root.findall('visible_pass'):
        try:
            data = {
                'country': vp.findtext('country'),
                'region': vp.findtext('region'),
                'city': vp.findtext('city'),
                'spacecraft': vp.findtext('spacecraft'),
                'sighting_date': vp.findtext('sighting_date'),
                'duration_minutes': safe_int(vp.findtext('duration_minutes')),
                'max_elevation': safe_int(vp.findtext('max_elevation')),
                'enters': vp.findtext('enters'),
                'exits': vp.findtext('exits'),
                'utc_offset': safe_float(vp.findtext('utc_offset')),
                'utc_time': vp.findtext('utc_time'),
                'utc_date': vp.findtext('utc_date')
            }
            passes.append(data)
        except Exception:
            continue
    return passes

DATA_FOLDER = "xml_data"
all_visible_passes = []
for xml_file in glob.glob(os.path.join(DATA_FOLDER, "*.xml")):
    all_visible_passes.extend(parse_xml_file(xml_file))

VISIBLE_PASSES = all_visible_passes

@app.get("/passes", response_model=List[SightingPass])
def get_passes(city: Optional[str] = None, country: Optional[str] = None, date: Optional[str] = None):
    results = VISIBLE_PASSES
    if city:
        results = [p for p in results if p['city'] and p['city'].lower() == city.lower()]
    if country:
        results = [p for p in results if p['country'] and p['country'].lower() == country.lower()]
    if date:
        results = [p for p in results if p['utc_date'] == date]
    if not results:
        raise HTTPException(status_code=404, detail="No passes found")
    return results

@app.get("/cities", response_model=List[str])
def get_cities():
    return sorted(list({p['city'] for p in VISIBLE_PASSES if p['city']}))

@app.get("/countries", response_model=List[str])
def get_countries():
    return sorted(list({p['country'] for p in VISIBLE_PASSES if p['country']}))

@app.get("/next-pass", response_model=NextPass)
def next_pass(lat: float, lon: float, elevation_m: float = 0.0):
    """
    Returns the next visible ISS pass for the given observer location, always in IST.
    """
    observer = wgs84.latlon(lat, lon, elevation_m)
    now = datetime.now(timezone.utc)
    t0 = ts.utc(now)
    t1 = ts.utc(now + timedelta(days=1))

    times, events = iss.find_events(observer, t0, t1, altitude_degrees=10.0)

    # events: 0 = rise, 1 = culmination, 2 = set
    try:
        rise_t = times[events == 0][0]
        culm_t = times[events == 1][0]
        set_t = times[events == 2][0]
    except IndexError:
        raise HTTPException(status_code=404, detail="No pass found in the next 24 hours")

    duration = (set_t.utc_datetime() - rise_t.utc_datetime()).total_seconds()
    topocentric = (iss - observer).at(culm_t)
    alt, az, distance = topocentric.altaz()

    # Always use IST
    obs_tz = pytz_timezone("Asia/Kolkata")
    enters_local = rise_t.utc_datetime().replace(tzinfo=UTC).astimezone(obs_tz)
    exits_local = set_t.utc_datetime().replace(tzinfo=UTC).astimezone(obs_tz)

    return NextPass(
        enters=enters_local.strftime("%Y-%m-%d %H:%M:%S %Z"),
        max_elevation=alt.degrees,
        exits=exits_local.strftime("%Y-%m-%d %H:%M:%S %Z"),
        duration_seconds=duration,
        observer_lat=lat,
        observer_lon=lon
    )

@app.get("/iss-location-at", response_model=ISSLocation)
def get_iss_location_at(

    minutes_from_now: int = Query(0, description="Minutes from now; negative for past")
):
    # Use timezone-aware arithmetic
    target_time = datetime.now(tz=timezone.utc) + timedelta(minutes=minutes_from_now)
    t = ts.utc(target_time.year, target_time.month, target_time.day,
               target_time.hour, target_time.minute, target_time.second)
    geocentric = iss.at(t)
    subpoint = wgs84.subpoint(geocentric)

    return ISSLocation(
        timestamp_utc=target_time.isoformat(),
        latitude=subpoint.latitude.degrees,
        longitude=subpoint.longitude.degrees,
        altitude_km=subpoint.elevation.km
    )



@app.get("/current-iss")
def current_iss():
    try:
        response = requests.get("http://api.open-notify.org/iss-now.json")
        data = response.json()
        if data["message"] != "success":
            raise HTTPException(status_code=500, detail="ISS API error")
        position = {
            "latitude": float(data["iss_position"]["latitude"]),
            "longitude": float(data["iss_position"]["longitude"])
        }
        return position
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
