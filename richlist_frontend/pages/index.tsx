import { useEffect, useState, useCallback, useRef } from 'react';
 import Head from 'next/head';

 // Debounce helper function that waits for `delay` milliseconds after the last call.
 function debounce<T extends unknown[]>(fn: (...args: T) => void, delay: number): (...args: T) => void {
   let timeoutId: ReturnType<typeof setTimeout>;
   return (...args: T) => {
     if (timeoutId) clearTimeout(timeoutId);
     timeoutId = setTimeout(() => fn(...args), delay);
   };
 }

 // Define an interface for validation errors returned by the backend.
 interface ValidationError {
   msg: string;
   param: string;
   location: string;
 }

 export default function Home() {
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [amount, setAmount] = useState('');
   const [link, setLink] = useState('');
   const [entryMessage, setEntryMessage] = useState('');
   const [message, setMessage] = useState('');
   const [loading, setLoading] = useState(false);
   const [leaderboard, setLeaderboard] = useState<{ name: string; amount: number; link?: string; message?: string }[]>([]);

   // State for exit intent modal and checkout flag.
   const [exitModalVisible, setExitModalVisible] = useState(false);
   const [hasSubmitted, setHasSubmitted] = useState(false);
   // Allow exit intent after a delay.
   const [canShowExitIntent, setCanShowExitIntent] = useState(false);
   // Use a ref to track the timestamp of the last form interaction.
   const lastInteractionRef = useRef<number | null>(null);
   // Inactivity threshold (milliseconds) if the user interacted.
   const INACTIVITY_THRESHOLD = 30000; // 30 seconds

   // Retrieve the API URL from environment variables.
   const apiUrl = process.env.NEXT_PUBLIC_API_URL;

   // Fetch the leaderboard.
   const fetchLeaderboard = useCallback(async () => {
     try {
       const res = await fetch(`${apiUrl}/api/leaderboard`);
       const data = await res.json();
       setLeaderboard(data);
     } catch (error) {
       console.error('Failed to fetch leaderboard:', error);
     }
   }, [apiUrl]);

   useEffect(() => {
     fetchLeaderboard();
   }, [fetchLeaderboard]);

   // Set a delay (10 seconds) before allowing exit intent.
   useEffect(() => {
     const timer = setTimeout(() => {
       setCanShowExitIntent(true);
     }, 10000);
     return () => clearTimeout(timer);
   }, []);

   // Handler to track form interaction.
   const handleFormInteraction = () => {
     lastInteractionRef.current = Date.now();
   };

   // Improved exit-intent listener with debounce and engagement/inactivity check.
   useEffect(() => {
     // Disable on small screens or touch devices.
     if (
       typeof window !== 'undefined' &&
       (window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
     ) {
       return;
     }
     // Only attach listener if exit intent is allowed and the user hasn't submitted.
     if (!canShowExitIntent || hasSubmitted) return;

     const debouncedHandleMouseOut = debounce<[MouseEvent]>((e) => {
       if (sessionStorage.getItem("exitIntentShown")) return;

       const lastInteraction = lastInteractionRef.current;
       // Only trigger if inactive or no interaction yet
       if (lastInteraction && Date.now() - lastInteraction < INACTIVITY_THRESHOLD) {
         // console.log("User still active, resetting exit intent timer");
         return; // Don't show if user was recently active
       }

       // Trigger when mouse leaves the top viewport area.
       if (!e.relatedTarget && e.clientY < 30) {
         setExitModalVisible(true);
         sessionStorage.setItem("exitIntentShown", "true"); // Prevent showing again in the same session.
       }
     }, 500); // Debounce for 500ms

     document.addEventListener("mouseout", debouncedHandleMouseOut as EventListener);
     return () => document.removeEventListener("mouseout", debouncedHandleMouseOut as EventListener);
   }, [canShowExitIntent, hasSubmitted]); // Depend on canShowExitIntent and hasSubmitted

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     const amountParsed = parseFloat(amount);
     if (!name || !email || isNaN(amountParsed) || amountParsed < 1) { // Added minimum amount check
       setMessage('Please fill in your name, email and a valid amount (£1 minimum!).');
       return;
     }
     setLoading(true);
     setMessage('');

     try {
       const res = await fetch(`${apiUrl}/api/submit`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name, email, amount: amountParsed, link, message: entryMessage }),
       });
       const data = await res.json();

       // Check if the response indicates an error.
       if (!res.ok) {
         if (data.errors && Array.isArray(data.errors)) {
           // Map validation errors to a readable string.
           const errorMessages = (data.errors as ValidationError[])
             .map((error) => error.msg)
             .join(' ');
           setMessage(errorMessages);
         } else if (data.message) {
           // Handle generic error messages from the backend.
           setMessage(data.message);
         } else {
           // Fallback error message.
           setMessage('Something went wrong! Please try again.');
         }
         setLoading(false);
         return;
       }

       // If successful and checkout URL is provided, redirect.
       if (data.url) {
         setHasSubmitted(true); // Mark as submitted to prevent exit intent
         window.location.href = data.url; // Redirect to Stripe checkout
       } else {
         // Handle case where backend confirms success but provides no URL (should not happen with Stripe).
         setMessage('Submission successful, but failed to redirect to payment.');
       }
     } catch (err) {
       console.error('Error:', err);
       // Handle network errors or issues connecting to the backend.
       setMessage('Failed to connect. Please check your internet connection and try again.');
     }
     // Only set loading false if not redirecting
     if (!window.location.href.startsWith('http')) { // Basic check if redirection didn't happen
        setLoading(false);
     }
   };

   return (
     <>
       <Head>
        <title>The Internet Rich List – Are You Rich Enough To Top The Leaderboard?</title>
        <meta
          name="description"
          content="Can you top The Internet Rich List? This pay-to-win leaderboard ranks those who prove their spending power. Put your money where your mouth is, buy your spot, and claim eternal bragging rights."
        />
        <meta
          name="keywords"
          content="rich list, world's richest, wealth, pay to win, leaderboard, bragging rights, wealth, spending power, elon musk, jeff bezos, kylie jenner"
        />
        <meta property="og:title" content="The Internet Rich List – Are You Rich Enough To Top The Leaderboard?" />
        <meta
          property="og:description"
          content="Can you top The Internet Rich List? This pay-to-win leaderboard ranks those who prove their spending power. Put your money where your mouth is, buy your spot, and claim eternal bragging rights."
        />
        <meta property="og:url" content="https://theinternetrichlist.com/" />
        <meta property="og:type" content="website" />
        {/* Explicitly provide an image */}
        <meta property="og:image" content="https://theinternetrichlist.com/preview-1200x630.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The Internet Rich List – Are You Rich Enough To Top The Leaderboard?" />
        <meta
          name="twitter:description"
          content="Can you top The Internet Rich List? This pay-to-win leaderboard ranks those who prove their spending power. Put your money where your mouth is, buy your spot, and claim eternal bragging rights."
        />
        {/* Explicitly provide an image for Twitter as well */}
        <meta name="twitter:image" content="https://theinternetrichlist.com/preview-1200x630.png" />
        <meta name="twitter:image:src" content="https://theinternetrichlist.com/preview-1200x630.png" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="canonical" href="https://theinternetrichlist.com/" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "The Internet Rich List",
              "url": "https://theinternetrichlist.com/",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://theinternetrichlist.com/?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            }),
          }}
        />
      </Head>
       <main className="w-full min-h-screen bg-black text-white font-sans overflow-y-auto">
         <div className="flex flex-col lg:flex-row">
           {/* Semantic Header Section */}
           <header className="w-full lg:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-start">
             <div className="mb-8 lg:mb-12">
               <h1 className="text-6xl lg:text-[6vw] leading-tight font-extralight uppercase tracking-tight">
                 <span>THE INTERNET</span>
                 <br />
                 <span className="relative inline-block">RICH LIST</span>
               </h1>
               {/* --- UPDATED TEXT --- */}
               <p className="mt-4 lg:mt-6 text-xl lg:text-2xl text-gray-400 max-w-xl">
               The ultimate social status leaderboard for those who truly put their money where their mouth is. Can you afford the top spot?
               </p>
               {/* --- END UPDATED TEXT --- */}
             </div>
             {/* --- FORM SECTION (Labels checked, look okay) --- */}
             <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 max-w-xl" noValidate>
               <div>
                 <label htmlFor="name" className="block text-base font-medium text-gray-400 mb-1">
                   Your Name or Alias
                 </label>
                 <input
                   id="name"
                   type="text"
                   value={name}
                   onFocus={handleFormInteraction} // Track interaction
                   onChange={(e) => setName(e.target.value)}
                   required
                   aria-required="true"
                   className="w-full bg-transparent border-b border-white px-0 py-2 text-white placeholder-white focus:outline-none focus:ring-0 focus:border-blue-500"
                 />
               </div>
               <div>
                 <label htmlFor="email" className="block text-base font-medium text-gray-400 mb-1">
                   Your Email
                 </label>
                 <input
                   id="email"
                   type="email"
                   value={email}
                   onFocus={handleFormInteraction} // Track interaction
                   onChange={(e) => setEmail(e.target.value)}
                   required
                   aria-required="true"
                   className="w-full bg-transparent border-b border-white px-0 py-2 text-white placeholder-white focus:outline-none focus:ring-0 focus:border-blue-500"
                 />
               </div>
               <div>
                 <label htmlFor="link" className="block text-base font-medium text-gray-400 mb-1">
                   Advertise Yourself (Optional URL)
                 </label>
                 <input
                   id="link"
                   type="url"
                   value={link}
                   onFocus={handleFormInteraction} // Track interaction
                   onChange={(e) => setLink(e.target.value)}
                   placeholder="https://example.com"
                   className="w-full bg-transparent border-b border-white px-0 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500"
                 />
               </div>
               <div>
                <label htmlFor="entryMessage" className="block text-base font-medium text-gray-400 mb-1">
                  Add a Message (Optional)
                </label>
                <textarea
                  id="entryMessage"
                  value={entryMessage}
                  onFocus={handleFormInteraction}
                  onChange={(e) => setEntryMessage(e.target.value)}
                  maxLength={70} // Example character limit, adjust as needed
                  rows={1}        // Adjust for desired initial height
                  className="w-full bg-transparent border-b border-white px-0 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500 resize-none" // Added resize-none
                />
              </div>
               <div>
                 <label htmlFor="amount" className="block text-base font-medium text-gray-400 mb-1">
                   Amount
                 </label>
                 <input
                   id="amount"
                   type="number"
                   value={amount}
                   onFocus={handleFormInteraction} // Track interaction
                   onChange={(e) => setAmount(e.target.value)}
                   required
                   aria-required="true"
                   min="1" // Set minimum amount
                   max="999999.99" // Optional: Set a max if needed
                   step="0.01"
                   placeholder="Min £1.00" // Add placeholder
                   className="w-full bg-transparent border-b border-white px-0 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500" // Changed placeholder color
                 />
               </div>
               {message && <p className="text-red-400 text-sm" role="alert">{message}</p>}
               <button
                 type="submit"
                 disabled={loading}
                 className="w-full py-3 border border-white text-black bg-white uppercase text-sm tracking-wide hover:bg-gray-200 transition disabled:opacity-50" // Added disabled style
               >
                 {loading ? 'Processing...' : 'Buy Your Spot'}
               </button>
               {/* --- UPDATED TEXT --- */}
               <p className="text-center text-xs text-gray-400">
                 Eternal bragging rights guaranteed. Your email is used only to update your leaderboard entry.
                 <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300 transition ml-1">Privacy Policy</a>
               </p>
               {/* --- END UPDATED TEXT --- */}
             </form>
           </header>
           {/* Leaderboard Section */}
           <section className="w-full lg:w-1/2 border-t lg:border-t-0 lg:border-l border-gray-800 p-4 sm:p-8 lg:h-screen lg:overflow-y-auto md:min-h-screen"> {/* Adjusted padding */}
  <h2 className="text-3xl font-semibold mb-6">Leaderboard</h2>
  {leaderboard.length > 0 ? (
    <table className="w-full text-white" role="table">
      <thead>
        <tr className="border-b border-gray-700 text-sm text-gray-400 uppercase tracking-wider">
          {/* Adjusted padding and added responsive visibility for Message header */}
          <th className="px-2 py-2 sm:px-4 text-left">#</th>
          <th className="px-2 py-2 sm:px-4 text-left">Name / Alias</th>
          <th className="px-2 py-2 sm:px-4 text-left hidden md:table-cell">Message</th> {/* Visible on md screens and up */}
          <th className="px-2 py-2 sm:px-4 text-right">Amount Paid</th>
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((entry, index) => (
          <tr key={index} className="hover:bg-gray-900 border-b border-gray-800">
            {/* Position Number - adjusted padding */}
            <td className="px-2 py-3 sm:px-4 whitespace-nowrap">{index + 1}</td>
            
            {/* Name / Alias & Mobile Message Display */}
            <td className="px-2 py-3 sm:px-4 min-w-0"> {/* Added min-w-0 for better wrapping with break-words */}
              <div> {/* Container for name/link */}
                {entry.link ? (
                  <a
                    href={entry.link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline hover:text-gray-300 transition font-medium break-words" // break-words to help wrapping
                  >
                    {entry.name}
                  </a>
                ) : (
                  <span className="font-medium break-words">{entry.name}</span> // break-words
                )}
              </div>
              {/* Message display for MOBILE (under name), hidden on md screens and up */}
              {entry.message && (
                <p className="text-xs text-gray-500 mt-1 break-words whitespace-normal overflow-hidden md:hidden">
                  {entry.message}
                </p>
              )}
            </td>

            {/* Dedicated Message cell for DESKTOP, hidden on smaller screens */}
            <td className="px-2 py-3 sm:px-4 text-sm text-gray-400 hidden md:table-cell max-w-[120px] sm:max-w-xs md:max-w-sm overflow-hidden break-words whitespace-normal"> {/* Adjusted max-widths and responsive points */}
              {entry.message ? `${entry.message}` : <span className="text-gray-600">-</span>} {/* Show dash if no message */}
            </td>

            {/* Amount Paid - adjusted padding */}
            <td className="px-2 py-3 sm:px-4 text-right whitespace-nowrap">
              {`£${entry.amount.toLocaleString('en-GB', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p className="text-gray-400">The leaderboard is currently empty. Be the first to claim the top spot!</p>
  )}
</section>
         </div>
         {/* Exit-Intent Modal (temporarily disabled in your code, text updated) */}
         {false && exitModalVisible && !hasSubmitted && (
           <div
             role="dialog"
             aria-modal="true"
             aria-labelledby="exitModalTitle"
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 transition-opacity duration-300"
             onKeyDown={(e) => {
               if (e.key === 'Escape') {
                 setExitModalVisible(false);
               }
             }}
             tabIndex={-1} // Make modal focusable
           >
             <div className="w-11/12 md:w-1/3 bg-gray-900 p-8 rounded shadow-lg relative border border-gray-700"> {/* Changed background and width */}
               <button
                 onClick={() => setExitModalVisible(false)}
                 className="absolute top-2 right-3 text-gray-400 hover:text-white text-3xl font-bold focus:outline-none" // Adjusted position and style
                 aria-label="Close exit modal"
               >
                 &times;
               </button>
               {/* --- UPDATED TEXT --- */}
               <h1 id="exitModalTitle" className="text-2xl md:text-3xl font-light normal-case text-left text-white mb-4"> {/* Adjusted size */}
                 Leaving so soon? Top spot too pricey?
               </h1>
               <p className="text-gray-400 mb-6">Someone else is gonna grab that sweet, sweet leaderboard glory...</p>
               <button
                 onClick={() => setExitModalVisible(false)} // Simply close modal, user can interact with form
                 className="w-full py-2 border border-white text-black bg-white uppercase text-sm tracking-wide hover:bg-gray-200 transition"
               >
                 Maybe I&apos;ll reconsider...
               </button>
               {/* --- END UPDATED TEXT --- */}
             </div>
           </div>
         )}
       </main>
       <style jsx>{`
         main {
           background: linear-gradient(135deg, #000, #1a1a1a); /* Slightly adjusted gradient */
         }
         /* Style for disabled button */
         button:disabled {
            cursor: not-allowed;
         }
       `}</style>
     </>
   );
 }