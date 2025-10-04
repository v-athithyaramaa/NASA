# filename: main.py
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
import xml.etree.ElementTree as ET
from typing import List, Optional
import glob
import os
from datetime import datetime

app = FastAPI(title="Dynamic ISS Visible Pass API", version="1.2")

# Pydantic model
class VisiblePass(BaseModel):
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

# Helper functions
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

# Parse single XML file
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
        except Exception as e:
            print(f"Skipping invalid entry in {file_path}: {e}")
    return passes

# Load all XML files from folder
DATA_FOLDER = "xml_data"
all_visible_passes = []
for xml_file in glob.glob(os.path.join(DATA_FOLDER, "*.xml")):
    all_visible_passes.extend(parse_xml_file(xml_file))

print(f"Loaded {len(all_visible_passes)} visible passes from XML files.")
VISIBLE_PASSES = all_visible_passes

# Standard endpoints
@app.get("/passes", response_model=List[VisiblePass])
def get_passes(
    city: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    date: Optional[str] = Query(None)
):
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

# 