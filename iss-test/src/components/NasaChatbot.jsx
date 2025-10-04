import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Send,
  Clock,
  Database,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import RedisService from "../services/RedisService";
import { toast } from "react-toastify";
const formatResponse = (text) => {
  if (!text) return { __html: "" };
  let html = text;
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  const lines = html.split("\n");
  let inList = false;
  let newHtml = "";
  for (const line of lines) {
    if (line.trim().startsWith("*") || line.trim().startsWith("-")) {
      if (!inList) {
        newHtml += "<ul>";
        inList = true;
      }
      newHtml += `<li>${line.replace(/[*-]\s*/, "").trim()}</li>`;
    } else {
      if (inList) {
        newHtml += "</ul>";
        inList = false;
      }
      if (line.trim() !== "") {
        newHtml += `<p>${line.trim()}</p>`;
      }
    }
  }
  if (inList) newHtml += "</ul>";
  if (!newHtml.startsWith("<p>")) {
    newHtml = `<p>${newHtml}</p>`;
  }
  return { __html: newHtml };
};
const callGeminiAPI = async (prompt, retries = 3, delay = 1000) => {
  const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
  const payload = { contents: chatHistory }; // NOTE: This should be retrieved from an environment variable in a production application.
  const apiKey = "YOUR_API_KEY_HERE";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    return "API key is not configured. Please check your environment variables.";
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
    return "Sorry, there was a critical error connecting to the AI service.";
  }
};
export default function NasaChatbot() {
  const [messages, setMessages] = useState([
    {
      text: "Hello! I'm an AI expert on NASA's history. Ask me anything about missions, astronauts, or discoveries!",
      sender: "bot",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState({
    hitRate: 0,
    totalCached: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastUpdated: Date.now(),
  });
  const [showCacheInfo, setShowCacheInfo] = useState(false);
  const [redisService] = useState(() => new RedisService());
  const [isRedisOnline, setIsRedisOnline] = useState(true);
  const chatEndRef = useRef(null);
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const history = await redisService.loadChatHistory();
        if (history.messages && history.messages.length > 0) {
          setMessages(history.messages);
          toast.success(
            `Restored ${history.messages.length} messages from chat history`
          );
        }
        const stats = await redisService.getCacheStatistics();
        setCacheStats({
          hitRate: stats?.hitRate || 0,
          totalCached: stats?.totalCached || 0,
          cacheHits: stats?.cacheHits || 0,
          cacheMisses: stats?.cacheMisses || 0,
          lastUpdated: stats?.lastUpdated || Date.now(),
        });
        setIsRedisOnline(redisService.isServerOnline());
      } catch (error) {
        console.warn("Failed to initialize chat:", error);
        setIsRedisOnline(false);
      }
    };
    initializeChat();
  }, [redisService]);
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);
  const handleSend = async () => {
    if (input.trim() === "" || isLoading) return;
    const userMessage = { text: input, sender: "user" };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const currentInput = input;
    setInput("");
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const cached = await redisService.getCachedChatbotResponse(currentInput);
      if (cached) {
        const botMessage = {
          text: cached.response,
          sender: "bot",
          fromCache: true,
          hitCount: cached.hitCount,
          metadata: cached.metadata,
        };
        const finalMessages = [...updatedMessages, botMessage];
        setMessages(finalMessages);
        await redisService.saveChatHistory(finalMessages);
        const stats = await redisService.getCacheStatistics();
        setCacheStats({
          hitRate: stats?.hitRate || 0,
          totalCached: stats?.totalCached || 0,
          cacheHits: stats?.cacheHits || 0,
          cacheMisses: stats?.cacheMisses || 0,
          lastUpdated: stats?.lastUpdated || Date.now(),
        });
        setIsRedisOnline(redisService.isServerOnline());
        toast.success(
          `Response served from Redis cache! (Hit #${cached.hitCount})`,
          {
            position: "bottom-right",
            autoClose: 2000,
          }
        );
        return;
      }
      const similarResponses = await redisService.findSimilarCachedResponses(
        currentInput,
        0.8
      );
      if (similarResponses.length > 0) {
        const bestMatch = similarResponses[0];
        const botMessage = {
          text: `*Based on similar query: "${bestMatch.originalQuery}"*\n\n${bestMatch.response}`,
          sender: "bot",
          fromCache: true,
          similarity: bestMatch.similarity,
          metadata: bestMatch.metadata,
        };
        const finalMessages = [...updatedMessages, botMessage];
        setMessages(finalMessages);
        await redisService.saveChatHistory(finalMessages);
        toast.info(
          `Found similar cached response (${Math.round(
            bestMatch.similarity * 100
          )}% match)`,
          {
            position: "bottom-right",
            autoClose: 3000,
          }
        );
        return;
      }
      const prompt = `You are a helpful and knowledgeable assistant specializing in NASA's history. Answer the following question concisely and accurately, using markdown lists (* or -) and **bold text** where appropriate. Question: ${currentInput}`;
      const botResponseText = await callGeminiAPI(prompt);
      const responseTime = Date.now() - startTime;
      await redisService.cacheChatbotResponse(currentInput, botResponseText, {
        responseTime,
        tokenCount: botResponseText.length,
        queryLength: currentInput.length,
      });
      const botMessage = {
        text: botResponseText,
        sender: "bot",
        fromCache: false,
        responseTime,
      };
      const finalMessages = [...updatedMessages, botMessage];
      setMessages(finalMessages);
      await redisService.saveChatHistory(finalMessages);
      const stats = await redisService.getCacheStatistics();
      setCacheStats({
        hitRate: stats?.hitRate || 0,
        totalCached: stats?.totalCached || 0,
        cacheHits: stats?.cacheHits || 0,
        cacheMisses: stats?.cacheMisses || 0,
        lastUpdated: stats?.lastUpdated || Date.now(),
      });
      setIsRedisOnline(redisService.isServerOnline());
      toast.success(`New response cached in Redis! (${responseTime}ms)`, {
        position: "bottom-right",
        autoClose: 2000,
      });
    } catch (error) {
      console.error("Failed to get response from AI:", error);
      const errorMessage = {
        text: "Sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a moment.",
        sender: "bot",
      };
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      try {
        await redisService.saveChatHistory(finalMessages);
      } catch (saveError) {
        console.warn("Failed to save error state to Redis:", saveError);
      }
      toast.error("Failed to get AI response", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="chatbot-container-wrapper">
      <div className="chatbot-header">
        <h1 className="page-title">NASA History AI Chatbot</h1>
        {}
        <div className="cache-info-panel">
          {}
          <div
            className={`redis-status ${isRedisOnline ? "online" : "offline"}`}
          >
            {isRedisOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>
              {isRedisOnline
                ? "Caching is ready"
                : "Caching not ready - Offline"}
            </span>
          </div>
          <button
            className="cache-toggle-btn"
            onClick={() => setShowCacheInfo(!showCacheInfo)}
            title="Cache Statistics"
          >
            <Database size={16} />
            Cache: {(cacheStats?.hitRate || 0).toFixed(1)}%
          </button>
          {showCacheInfo && (
            <div className="cache-stats-dropdown">
              <div className="cache-stat">
                <TrendingUp size={14} />
                <span>Hit Rate: {(cacheStats?.hitRate || 0).toFixed(1)}%</span>
              </div>
              <div className="cache-stat">
                <Database size={14} />
                <span>Total Cached: {cacheStats?.totalCached || 0}</span>
              </div>
              <div className="cache-stat">
                <Clock size={14} />
                <span>Cache Hits: {cacheStats?.cacheHits || 0}</span>
              </div>
              <button
                className="clear-cache-btn"
                onClick={async () => {
                  try {
                    const success = await redisService.clearCache();
                    if (success) {
                      setCacheStats({
                        hitRate: 0,
                        totalCached: 0,
                        cacheHits: 0,
                        cacheMisses: 0,
                        lastUpdated: Date.now(),
                      });
                      const newSessionId = redisService.resetSession();
                      setMessages([
                        {
                          text: "Hello! I'm an AI expert on NASA's history. Ask me anything about missions, astronauts, or discoveries!",
                          sender: "bot",
                        },
                      ]);
                      toast.success(
                        `Cache cleared and new session started: ${newSessionId}`
                      );
                    } else {
                      toast.error("Failed to clear cache");
                    }
                  } catch (error) {
                    console.error("Cache clear error:", error);
                    toast.error("Error clearing cache");
                  }
                }}
              >
                Clear Cache & Reset Session
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="chatbot-container">
        {" "}
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message-row ${msg.sender}`}>
              {msg.sender === "bot" && (
                <div className="bot-icon-container">
                  <Bot size={24} className="bot-icon" />
                  {msg.fromCache && (
                    <div
                      className="cache-indicator"
                      title="Response from cache"
                    >
                      <Database size={12} />
                    </div>
                  )}
                </div>
              )}
              <div className="message-content">
                <div
                  className="message-bubble"
                  dangerouslySetInnerHTML={formatResponse(msg.text)}
                />
                {}
                {msg.sender === "bot" && (
                  <div className="message-metadata">
                    {msg.fromCache ? (
                      <span className="cache-badge">
                        <Database size={10} />
                        Cached {msg.hitCount ? `(Hit #${msg.hitCount})` : ""}
                        {msg.similarity &&
                          ` - ${Math.round(msg.similarity * 100)}% match`}
                      </span>
                    ) : (
                      <span className="api-badge">
                        <Clock size={10} />
                        Fresh ({msg.responseTime}ms)
                      </span>
                    )}
                  </div>
                )}
              </div>
              {msg.sender === "user" && <div className="user-icon">👤</div>}
            </div>
          ))}
          {isLoading && (
            <div className="message-row bot">
              <Bot size={24} className="bot-icon" />{" "}
              <div className="message-bubble loading-state">
                {}
                <span className="loading-dots"></span>{" "}
              </div>{" "}
            </div>
          )}
          <div ref={chatEndRef} />{" "}
        </div>{" "}
        <div className="chat-input-area">
          {" "}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about the Apollo missions, JWST, etc..."
            className="chat-input"
            disabled={isLoading}
          />{" "}
          <button
            onClick={handleSend}
            className="chat-send-button"
            disabled={isLoading || input.trim() === ""}
          >
            <Send size={20} /> Send{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
