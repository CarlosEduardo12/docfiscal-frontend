export default function TestStylesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Style Test</h1>
        <p className="text-gray-600 mb-6">
          If you can see this styled properly, Tailwind CSS is working correctly.
        </p>
        
        <div className="space-y-4">
          <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors">
            Primary Button
          </button>
          
          <button className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition-colors">
            Success Button
          </button>
          
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-semibold text-gray-800">Card Component</h3>
            <p className="text-sm text-gray-600">This is a test card with Tailwind styles.</p>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
            Badge Test
          </span>
        </div>
      </div>
    </div>
  );
}