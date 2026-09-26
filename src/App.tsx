import { Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PwaStatus } from './components/PwaStatus'
import { ItemFormPage } from './pages/ItemFormPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { ProjectListPage } from './pages/ProjectListPage'
import { ProjectPage } from './pages/ProjectPage'
import { ReportPreviewPage } from './pages/ReportPreviewPage'
import { VisitDetailPage } from './pages/VisitDetailPage'
import { VisitFormPage } from './pages/VisitFormPage'

function App() {
  return (
    <>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<ProjectListPage />} />
          <Route path="/projects/new" element={<ProjectDetailsPage />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/projects/:id/details" element={<ProjectDetailsPage />} />
          <Route path="/projects/:projectId/visits/new" element={<VisitFormPage />} />
          <Route path="/visits/:visitId" element={<VisitDetailPage />} />
          <Route path="/visits/:visitId/edit" element={<VisitFormPage />} />
          <Route path="/visits/:visitId/items/new" element={<ItemFormPage />} />
          <Route path="/items/:itemId/edit" element={<ItemFormPage />} />
          <Route path="/visits/:visitId/preview" element={<ReportPreviewPage />} />
        </Routes>
      </ErrorBoundary>
      <PwaStatus />
    </>
  )
}

export default App
