import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar'; // Adjust import path as needed
import HomeImage from '../assets/homeImage.webp'


const Home = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6IjEifQ.eyJpc3MiOiJuYWRsZXMiLCJpYXQiOiIxNzQ1Mjg4MzYyIiwicHVycG9zZSI6ImFwaV9hdXRoZW50aWNhdGlvbiIsInN1YiI6Ijc4OTc3Y2U3MjZmMzRiZDFhZTcwOTJlMTcyOGY1ODIxIn0.-ikSG1v9D6csDJaNWLpz7ct4dRdyHQTxN1CffJKegTQ';
  const GEMINI_API_KEY = 'AIzaSyA6j1QQ77ETh5v7ImpSCWT6ZCWVDlGnOSg';

  const getYouTubeVideoId = (url) => {
    const regexes = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/user\/\S+\/\S+\/\S+|youtube\.com\/user\/\S+\/\S+|youtube\.com\/\S+\/\S+\/\S+|youtube\.com\/\S+\/\S+|youtube\.com\/\S+)([^"&?/\s]{11})/,
      /(?:youtube\.com.*(?:v=|\/v\/|\/embed\/)|youtu\.be\/)([^"&?/\s]{11})/
    ];
    for (const regex of regexes) {
      const match = url.match(regex);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const getTranscript = async () => {
    if (!videoUrl) {
      setError('Please enter a YouTube URL');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const videoId = getYouTubeVideoId(videoUrl);
      if (!videoId) {
        setError('Invalid YouTube URL. Please enter a valid YouTube video link.');
        setLoading(false);
        return;
      }
      const response = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok || !data?.content) {
        throw new Error(data?.message || 'No transcript found for this video');
      }
      const notesResponse = await processWithGemini(data.content, videoId);
      navigate('/notes', {
        state: {
          transcript: data.content,
          notes: notesResponse,
          videoId: videoId,
          videoUrl: videoUrl,
          lang: data.lang || 'en',
          availableLangs: data.availableLangs || ['en']
        }
      });
    } catch (err) {
      setError(err.message || 'Something went wrong while processing the video');
    } finally {
      setLoading(false);
    }
  };

  const processWithGemini = async (transcript) => {
    const truncatedTranscript = transcript.length > 30000
      ? transcript.substring(0, 30000) + "... (transcript truncated due to length)"
      : transcript;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{
        parts: [{
          text: `Create comprehensive, well-structured notes from the following YouTube video transcript. 
          Break it down into sections with clear headings, don't use any puctuation marks , also remove all the special symbols used, don't use asterisk (*) symbol in the lines and summarize main ideas, make sure it relates to the topic of the video and should also include examples that simplifies learning.
          Format the response in markdown.
          TRANSCRIPT:
          ${truncatedTranscript}`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error('Failed to generate notes with AI');
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No content returned.';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      getTranscript();
    }
  };

  return (
    <>
      <Navbar />
    <div className="mt-20 px-6 md:px-10 lg:px-20 font-semibold min-h-[70vh]">
      <div className="flex flex-col md:flex-row gap-10 lg:gap-60 items-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-center md:text-left">
          What Do You Want <br />To <span id='redLink'>Summarize ?</span>
        </h1>
        <img src={HomeImage} alt="" className='h-70' />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mt-12">
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube link and press Enter"
          className="p-2 border border-gray-300 rounded w-full sm:w-[400px] md:w-[500px] lg:w-[600px]"
          disabled={loading}
        />
        <button
          onClick={getTranscript}
          disabled={loading || !videoUrl}
          className="bg-red-500 hover:bg-black text-white font-medium py-2 px-4 rounded-lg disabled:bg-red-400 transition w-full sm:w-auto"
        >
          {loading ? 'Processing...' : '->'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-center max-w-xl mx-auto">
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="mt-6 text-center">
          <p className="text-gray-600">This may take a minute or two...</p>
          <div className="mt-2 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      )}
    </div>
    </>

  );
};

export default Home;
