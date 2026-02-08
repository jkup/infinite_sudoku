import { BrowserRouter, Routes, Route } from 'react-router-dom'

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Infinite Sudoku
      </h1>
      <p className="text-gray-500 text-lg">Coming soon...</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
