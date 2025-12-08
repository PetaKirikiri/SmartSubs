import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-indigo-900 mb-4">SmartSubs</h1>
        <p className="text-lg text-gray-700 mb-8">Welcome to your React app</p>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Tailwind CSS Example</h2>
          <p className="text-gray-600 mb-4">
            This card demonstrates Tailwind's utility classes working correctly!
          </p>
          <div className="flex gap-4 flex-wrap">
            <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Primary Button
            </button>
            <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Success Button
            </button>
            <button className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Danger Button
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-500 text-white p-6 rounded-lg text-center">
            <div className="text-3xl font-bold mb-2">1</div>
            <div className="text-sm">Grid Item</div>
          </div>
          <div className="bg-pink-500 text-white p-6 rounded-lg text-center">
            <div className="text-3xl font-bold mb-2">2</div>
            <div className="text-sm">Grid Item</div>
          </div>
          <div className="bg-yellow-500 text-white p-6 rounded-lg text-center">
            <div className="text-3xl font-bold mb-2">3</div>
            <div className="text-sm">Grid Item</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

