import { Route, Routes } from 'react-router-dom'
import { PwaStatus } from './components/PwaStatus'
import { ItemFormPage } from './pages/ItemFormPage'
import { ProjectListPage } from './pages/ProjectListPage'
import { ProjectSetupPage } from './pages/ProjectSetupPage'
import { VisitDetailPage } from './pages/VisitDetailPage'
import { VisitFormPage } from './pages/VisitFormPage'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<ProjectSetupPage />} />
        <Route path="/projects/:id" element={<ProjectSetupPage />} />
        <Route path="/projects/:projectId/visits/new" element={<VisitFormPage />} />
        <Route path="/visits/:visitId" element={<VisitDetailPage />} />
        <Route path="/visits/:visitId/edit" element={<VisitFormPage />} />
        <Route path="/visits/:visitId/items/new" element={<ItemFormPage />} />
        <Route path="/items/:itemId/edit" element={<ItemFormPage />} />
      </Routes>
      <PwaStatus />
    </>
  )
}

export default App
