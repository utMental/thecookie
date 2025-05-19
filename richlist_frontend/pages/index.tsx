import { useEffect, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';

interface ValidationError {
  msg: string;
  param: string;
  location: string;
}

interface LeaderboardEntry {
  name: string;
  amount: number;
  message?: string;
  locationLabel?: string; // For displaying current owner's location
  lat?: number; // For globe
  lng?: number; // For globe
}

// Define LocationInput outside of Home component for stability
function LocationInput({
  onSelect
}: {
  onSelect: (loc: { label: string; lat: number; lng: number }) => void;
}) {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions
  } = usePlacesAutocomplete({ debounce: 300 });

  return (
    <div>
      <label htmlFor="location" className="block text-gray-400 mb-1">
        Your City
      </label>
      <input
        id="location"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={!ready}
        placeholder="Start typing your city..."
        className="w-full bg-transparent border-b border-white py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
      />
      {status === 'OK' && (
        <ul className="bg-white text-black max-h-40 overflow-y-auto">
          {data.map((suggestion: { place_id: string; description: string }) => (
            <li
              key={suggestion.place_id}
              onClick={async () => {
                // Set the input value immediately
                setValue(suggestion.description, false); 

                // Defer clearing suggestions and geocoding to allow React to process the setValue update
                setTimeout(async () => {
                  clearSuggestions();
                  try {
                    const results = await getGeocode({ placeId: suggestion.place_id });
                    const { lat, lng } = await getLatLng(results[0]);
                    onSelect({ label: suggestion.description, lat, lng });
                  } catch (error) {
                    console.error("Error processing place selection:", error);
                  }
                }, 0);
              }}
              className="px-2 py-1 hover:bg-gray-200 cursor-pointer"
            >
              {suggestion.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [entryMessage, setEntryMessage] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const globeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isGlobeListenerReady, setIsGlobeListenerReady] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/leaderboard`);
      const data = (await res.json()) as LeaderboardEntry[];
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      // Important: Check the origin of the message for security
      if (event.origin !== window.origin) {
        // Or if your iframe is on a different known origin:
        // if (event.origin !== 'expected-iframe-origin.com') {
        console.warn('[Parent] Message received from unexpected origin:', event.origin);
        return;
      }

      if (event.data && event.data.type === 'GLOBE_LISTENER_READY') {
        console.log('[Parent] Received GLOBE_LISTENER_READY from iframe.');
        setIsGlobeListenerReady(true);
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, []); // Empty dependency array, runs once on mount

  useEffect(() => {
    console.log('[Parent] Leaderboard updated. Length:', leaderboard.length);
    if (leaderboard.length > 0 && isGlobeListenerReady) { // Only proceed if listener is ready
      const currentOwner = leaderboard[0];
      console.log('[Parent] Current owner data for globe:', currentOwner);

      if (globeIframeRef.current && globeIframeRef.current.contentWindow) {
        console.log('[Parent] Iframe reference and contentWindow found.');
        if (currentOwner.lat !== undefined && currentOwner.lng !== undefined) {
          const messagePayload = {
            type: 'UPDATE_GLOBE_LOCATION',
            payload: {
              lat: currentOwner.lat,
              lng: currentOwner.lng,
            },
          };
          console.log('[Parent] Posting UPDATE_GLOBE_LOCATION to globe iframe:', JSON.stringify(messagePayload));
          globeIframeRef.current.contentWindow.postMessage(messagePayload, window.origin);
        } else {
          console.warn('[Parent] Current owner has no lat/lng. Not posting message to globe.');
        }
      } else {
        console.warn('[Parent] Globe iframe reference or contentWindow not available yet.');
      }
    } else if (leaderboard.length > 0 && !isGlobeListenerReady) {
      console.log('[Parent] Leaderboard updated, but globe listener is not ready yet. Message will be sent when ready.');
    } else {
      console.log('[Parent] Leaderboard is empty. Not attempting to post message.');
    }
  }, [leaderboard, isGlobeListenerReady]); // Re-run when leaderboard OR isGlobeListenerReady changes
  

  const handleLocationSelect = useCallback((loc: { label: string; lat: number; lng: number }) => {
    setLocation(loc);
    // console.log('Location selected:', loc); // Optional: for debugging
  }, []); // setLocation is stable, so empty dependency array is fine

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages

    // Client-side validation
    const validationErrorMessages: string[] = [];
    if (!name.trim()) {
      validationErrorMessages.push('Name is required.');
    }
    if (!location) {
      validationErrorMessages.push('City & Country is required.');
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1) {
      validationErrorMessages.push('Bid must be at least £1.');
    }

    if (validationErrorMessages.length > 0) {
      setMessage(validationErrorMessages.join(' '));
      setLoading(false); // Ensure loading is reset
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          locationLabel: location!.label,
          lat: location!.lat,
          lng: location!.lng,
          amount: amt,
          message: entryMessage
        })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const backendErrors = (data.errors as ValidationError[])
            .filter(err => err.param !== 'email') // Filter out backend email validation errors
            .map(err => err.msg);
          if (backendErrors.length > 0) {
            setMessage(backendErrors.join(' '));
          } else {
            setMessage('An unexpected validation error occurred. Please check your input.');
          }
        } else if (data.message) {
          setMessage(data.message);
        } else {
          setMessage('Something went wrong. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setMessage('Submission succeeded, but no redirect URL provided.');
      setLoading(false);
    } catch (err) {
      console.error(err);
      setMessage('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>The Cookie – Claim the One-and-Only Digital Cookie</title>
        <meta
          name="description"
          content="Only one person can own The Cookie at a time. Bid higher than the last owner to claim it and earn eternal bragging rights!"
        />
      </Head>

      <main className="w-full min-h-screen bg-black text-white font-sans overflow-y-auto">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Title + Form */}
          <header className="w-full lg:w-1/2 p-8 lg:p-16 flex flex-col justify-start">
            <h1 className="text-6xl lg:text-[6vw] font-extralight uppercase tracking-tight mb-4">
              The Cookie
            </h1>
            <p className="text-gray-400 text-xl lg:text-2xl max-w-xl mb-8">
              Claim the one-and-only digital cookie for bragging rights. Bid higher than the last owner!
            </p>
            {leaderboard.length > 0 && leaderboard[0].locationLabel && leaderboard[0].name && (
              <p className="text-yellow-400 text-lg lg:text-xl max-w-xl mb-8">
                The cookie is currently in <span className="font-semibold">{leaderboard[0].locationLabel}</span> and owned by <span className="font-semibold">{leaderboard[0].name}</span>.
              </p>
            )}


            <form onSubmit={handleSubmit} className="space-y-6 max-w-xl" noValidate>
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-gray-400 mb-1">
                  Your Name or Alias
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full bg-transparent border-b border-white py-2 text-white placeholder-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Location */}
              <LocationInput onSelect={handleLocationSelect} />

              {/* Message */}
              <div>
                <label htmlFor="entryMessage" className="block text-gray-400 mb-1">
                  Add a Message (Optional)
                </label>
                <textarea
                  id="entryMessage"
                  value={entryMessage}
                  onChange={e => setEntryMessage(e.target.value)}
                  maxLength={70}
                  rows={1}
                  className="w-full bg-transparent border-b border-white py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="amount" className="block text-gray-400 mb-1">
                  Amount
                </label>
                <input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  min={1}
                  step="0.01"
                  placeholder="Min £1.00"
                  className="w-full bg-transparent border-b border-white py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {message && (
                <p className="text-red-400 text-sm" role="alert">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-white text-black uppercase tracking-wide hover:bg-gray-200 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Buy the Cookie'}
              </button>
            </form>
          </header>

          {/* Right: Globe + Leaderboard */}
          <section className="w-full lg:w-1/2 border-t lg:border-t-0 lg:border-l border-gray-800 p-4 sm:p-8 flex flex-col items-center">
            {/* Container for the Globe Iframe */}
            <div className="w-full h-96 mb-8 bg-black"> {/* Ensure this container is black */}
            </div>
            <h2 className="text-3xl font-semibold mb-6">Leaderboard</h2>
            {leaderboard.length > 0 ? (
              <table className="w-full text-white" role="table">
                <thead>
                  <tr className="border-b border-gray-700 text-sm text-gray-400 uppercase tracking-wider">
                    <th className="px-2 py-2 sm:px-4 text-left">#</th>
                    <th className="px-2 py-2 sm:px-4 text-left">Name / Alias</th>
                    <th className="px-2 py-2 sm:px-4 text-left hidden md:table-cell">Message</th>
                    <th className="px-2 py-2 sm:px-4 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-900 border-b border-gray-800">
                      <td className="px-2 py-3 sm:px-4 whitespace-nowrap">{i + 1}</td>
                      <td className="px-2 py-3 sm:px-4 min-w-0">{entry.name}</td>
                      <td className="px-2 py-3 sm:px-4 text-sm text-gray-400 hidden md:table-cell max-w-[120px] overflow-hidden break-words">
                        {entry.message || <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-2 py-3 sm:px-4 text-right whitespace-nowrap">
                        £{entry.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-400">No entries yet—be the first to claim The Cookie!</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
