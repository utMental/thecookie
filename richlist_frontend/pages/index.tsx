import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
// import dynamic from 'next/dynamic';
import type { Location } from '../components/Globe';
import GlobeComponent from '../components/Globe';

interface ValidationError {
  msg: string;
  param: string;
  location: string;
}

interface LeaderboardEntry {
  _id?: string;
  id?: string;
  name: string;
  amount: number;
  message?: string;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  timestamp?: string;
}

// const GlobeComponentWithNoSSR = dynamic( // Keep this commented out
//   () => import('../components/Globe'),
//   {
//     ssr: false,
//     loading: () => <div style={{ width: '100%', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'black', color: 'white' }}>Loading Globe...</div>
//   }
// );

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
        autoComplete="off"
      />
      {status === 'OK' && (
        <ul className="bg-white text-black max-h-40 overflow-y-auto mt-1 rounded shadow-lg z-10">
          {data.map((suggestion: { place_id: string; description: string }) => (
            <li
              key={suggestion.place_id}
              onClick={async () => {
                setValue(suggestion.description, false);
                clearSuggestions();
                try {
                  const results = await getGeocode({ address: suggestion.description });
                  const { lat, lng } = await getLatLng(results[0]);
                  onSelect({ label: suggestion.description, lat, lng });
                } catch (error) {
                  console.error("Error processing place selection:", error);
                }
              }}
              className="px-3 py-2 hover:bg-gray-200 cursor-pointer"
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
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ label: string; lat: number; lng: number } | null>(null); // Correct state name
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isClientMounted, setIsClientMounted] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/leaderboard`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = (await res.json()) as LeaderboardEntry[];
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  }, [apiUrl]);

  useEffect(() => {
    setIsClientMounted(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleLocationSelect = useCallback((loc: { label: string; lat: number; lng: number }) => {
    setLocation(loc); // Corrected: Use setLocation
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');
    setLoading(true);

    const validationErrorMessages: string[] = [];
    if (!name.trim()) validationErrorMessages.push('Name is required.');
    if (!location) validationErrorMessages.push('City & Country is required.'); // 'location' is the state variable
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1) validationErrorMessages.push('Bid must be at least £1.');

    if (validationErrorMessages.length > 0) {
      setStatusMessage(validationErrorMessages.join(' '));
      setLoading(false);
      return;
    }

    let res; // Define res here to be accessible in finally
    try {
      res = await fetch(`${apiUrl}/api/submit`, { // Assign to the outer res
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          locationLabel: location!.label, // location state variable
          lat: location!.lat,       // location state variable
          lng: location!.lng,       // location state variable
          amount: amt,
          message: entryMessage
        })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const backendErrors = (data.errors as ValidationError[]).map(err => err.msg);
          setStatusMessage(backendErrors.join(' '));
        } else if (data.message) {
          setStatusMessage(data.message);
        } else {
          setStatusMessage('Something went wrong. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return; // setLoading(false) is not needed on redirect
      }

      setStatusMessage(data.message || 'Submission successful!');
      await fetchLeaderboard();
      setName('');
      setAmount('');
      setEntryMessage('');
      setLocation(null);
      // Consider resetting LocationInput value here
      // (e.g., by passing `value` to LocationInput and having a reset function, or by key change)
      setLoading(false); // Set loading to false on non-redirect success

    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || 'Network error. Please try again.');
      setLoading(false); // Also set loading to false on catch
    }
    // Removed the complex finally block for setLoading as it's handled in try/catch now
  };
  
  // Data for the globe - Simplified for this test
  const globeData: Location[] = leaderboard
    .map(entry => ({
      lat: entry.lat,
      lng: entry.lng,
      owner: entry.name, 
      locationLabel: entry.locationLabel,
    }))
    .filter((loc): loc is Location => // Type predicate to ensure lat/lng are numbers
      typeof loc.lat === 'number' && typeof loc.lng === 'number'
    );


  return (
    <>
      <Head>
        <title>The Cookie Globe – Static Import Test (Simplified)</title>
        <meta
          name="description"
          content="Testing static import of simplified globe for The Cookie project."
        />
        <link rel="icon" href="/favicon.ico" />
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

              <LocationInput onSelect={handleLocationSelect} />

              <div>
                <label htmlFor="entryMessage" className="block text-gray-400 mb-1">
                  Add a Message (Optional, max 70 chars)
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

              <div>
                <label htmlFor="amount" className="block text-gray-400 mb-1">
                  Your Bid Amount (£)
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

              {statusMessage && (
                <p className={`text-sm ${statusMessage.includes('required') || statusMessage.includes('error') || statusMessage.includes('wrong') || statusMessage.includes('Network') ? 'text-red-400' : 'text-green-400'}`} role="alert">
                  {statusMessage}
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
            <div className="w-full h-96 lg:h-[50vh] mb-8 bg-black relative">
              {isClientMounted ? (
                <GlobeComponent locations={globeData} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'black', color: 'white' }}>Initializing Client State...</div>
              )}
            </div>
            
            <h2 className="text-3xl font-semibold mb-6">Leaderboard</h2>
            {leaderboard.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[600px] text-white" role="table">
                  <thead>
                    <tr className="border-b border-gray-700 text-sm text-gray-400 uppercase tracking-wider">
                      <th className="px-2 py-2 sm:px-4 text-left">#</th>
                      <th className="px-2 py-2 sm:px-4 text-left">Name / Alias</th>
                      <th className="px-2 py-2 sm:px-4 text-left hidden md:table-cell">Message</th>
                      <th className="px-2 py-2 sm:px-4 text-left hidden lg:table-cell">Location</th>
                      <th className="px-2 py-2 sm:px-4 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, i) => (
                      <tr key={entry._id || entry.id || i} className="hover:bg-gray-900 border-b border-gray-800">
                        <td className="px-2 py-3 sm:px-4 whitespace-nowrap">{i + 1}</td>
                        <td className="px-2 py-3 sm:px-4">{entry.name}</td>
                        <td className="px-2 py-3 sm:px-4 text-sm text-gray-300 hidden md:table-cell max-w-[120px] overflow-hidden break-words">
                          {entry.message || <span className="text-gray-600">-</span>}
                        </td>
                        <td className="px-2 py-3 sm:px-4 text-sm text-gray-300 hidden lg:table-cell max-w-[150px] overflow-hidden break-words">
                          {entry.locationLabel || <span className="text-gray-600">-</span>}
                        </td>
                        <td className="px-2 py-3 sm:px-4 text-right whitespace-nowrap">
                          £{typeof entry.amount === 'number' ? entry.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">No entries yet—be the first to claim The Cookie!</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}