import React, { useState } from "react";
import { X, Rocket } from "lucide-react";
const formatResponse = (text) => {
  if (!text) return { __html: "" };
  let html = text;
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  const lines = html.split("\n");
  let inList = false;
  let newHtml = "";
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/^#+\s/)) {
      if (inList) {
        newHtml += "</ul>";
        inList = false;
      }
      const headerText = trimmedLine.replace(/^#+\s*/, "");
      newHtml += `<h4>${headerText}</h4>`;
      continue; // Move to next line
    }
    if (trimmedLine.startsWith("*") || trimmedLine.startsWith("-")) {
      if (!inList) {
        newHtml += "<ul>";
        inList = true;
      }
      newHtml += `<li>${trimmedLine.replace(/[\*\-]\s*/, "").trim()}</li>`;
    } else {
      if (inList) {
        newHtml += "</ul>";
        inList = false;
      }
      if (trimmedLine !== "") {
        newHtml += `<p>${trimmedLine}</p>`;
      }
    }
  }
  if (inList) newHtml += "</ul>";
  return { __html: newHtml };
};
const callGeminiAPI = async (prompt, retries = 3, delay = 1000) => {
  const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
  const payload = { contents: chatHistory };
  const apiKey = "AIzaSyA7Cs2VMfGKs431nHym0dJfIYbAcBd0ITU";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    return "API key is not configured.";
  }
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        await new Promise((res) => setTimeout(res, delay));
        return callGeminiAPI(prompt, retries - 1, delay * 2);
      }
      throw new Error(`API responded with status: ${response.status}`);
    }
    const result = await response.json();
    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      console.error("Unexpected API response structure:", result);
      return "I couldn't find a clear answer for that. Could you try rephrasing?";
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (retries > 0) {
      await new Promise((res) => setTimeout(res, delay));
      return callGeminiAPI(prompt, retries - 1, delay * 2);
    }
    return "Could not load details at this time due to a network error.";
  }
};
export default function NasaHistory() {
  const [modalContent, setModalContent] = useState(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false); // Ensure data is structured for the timeline's functionality
  const historyData = [
    {
      year: 1998,
      event: "ISS construction begins with the launch of the Zarya module.",
    },
    {
      year: 2000,
      event: "Expedition 1 crew arrives, marking permanent human presence.",
    },
    { year: 2009, event: "Station crew size increases to six members." },
    {
      year: 2011,
      event: "Final Space Shuttle mission, STS-135, completes assembly.",
    },
    {
      year: 2020,
      event:
        "SpaceX Crew-1, the first operational commercial crew mission, docks.",
    },
    {
      year: 2021,
      event: "James Webb Space Telescope launched on an Ariane 5 rocket.",
    },
    {
      year: 2022,
      event:
        "Artemis I mission launches, an uncrewed test flight around the Moon.",
    },
    {
      year: 2024,
      event: "Planned launch of the Europa Clipper mission to Jupiter's moon.",
    },
  ];
  const handleLearnMore = async (item) => {
    setIsLoadingModal(true); // Set initial modal content while waiting for API
    setModalContent({
      year: item.year,
      event: item.event,
      details: "Generating detailed insights...",
    }); // Prompt explicitly asks the AI for markdown formatting
    const prompt = `Provide a detailed, engaging summary of the following NASA/Space related event: "${item.event}". Explain its significance and key objectives. Use markdown headers (#, ##, ###), lists (* or -) and **bold text** where appropriate.`;
    try {
      const details = await callGeminiAPI(prompt);
      setModalContent({ ...item, details });
    } catch (e) {
      setModalContent({
        ...item,
        details:
          "Could not load details at this time. Please check your connection or API key.",
      });
    } finally {
      setIsLoadingModal(false);
    }
  };
  return (
    <div className="history-container">
      <h1 className="page-title">25 Years of NASA & ISS History</h1>{" "}
      <div className="timeline">
        {" "}
        {historyData.map((item, index) => (
          <div
            key={index}
            className={`timeline-item ${index % 2 === 0 ? "left" : "right"}`}
          >
            <div className="timeline-spacer"></div>{" "}
            <div className="timeline-circle">{item.year}</div>{" "}
            <div className="timeline-item-content">
              <h3>{item.year}</h3> <p>{item.event}</p>{" "}
              <button
                onClick={() => handleLearnMore(item)}
                className="timeline-button"
              >
                ✨ Learn More{" "}
              </button>{" "}
            </div>{" "}
          </div>
        ))}{" "}
      </div>{" "}
      {modalContent && (
        <div className="modal-overlay">
          {" "}
          <div className="modal-content">
            {" "}
            <div className="modal-header">
              {" "}
              <h2>
                {modalContent.year}: {modalContent.event}{" "}
              </h2>{" "}
              <button
                onClick={() => setModalContent(null)}
                className="modal-close-button"
              >
                <X size={24} />{" "}
              </button>{" "}
            </div>{" "}
            <div className="modal-body">
              {" "}
              {isLoadingModal ? (
                <div className="modal-loader">
                  <Rocket size={48} className="loader-icon" />
                  <p>{modalContent.details}</p>{" "}
                </div>
              ) : (
                <div
                  className="ai-response-content"
                  dangerouslySetInnerHTML={formatResponse(modalContent.details)}
                />
              )}{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}{" "}
    </div>
  );
}
