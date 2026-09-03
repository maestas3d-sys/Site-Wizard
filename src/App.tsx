import { Route, Routes } from 'react-router-dom'
import { ProjectListPage } from './pages/ProjectListPage'
import { ProjectSetupPage } from './pages/ProjectSetupPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectListPage />} />
      <Route path="/projects/new" element={<ProjectSetupPage />} />
      <Route path="/projects/:id" element={<ProjectSetupPage />} />
    </Routes>
  )
}

export default App
