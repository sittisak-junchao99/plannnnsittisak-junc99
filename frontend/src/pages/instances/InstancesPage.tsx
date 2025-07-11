import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { 
  CalendarDaysIcon, 
  Squares2X2Icon, 
  ListBulletIcon,
  PlusIcon 
} from '@heroicons/react/24/outline'
import ScheduleGrid from '@/components/schedule/ScheduleGrid'
import ScheduleKanban from '@/components/schedule/ScheduleKanban'
import ScheduleList from '@/components/schedule/ScheduleList'
import CreateScheduleInstancePage from './CreateScheduleInstancePage'

type ViewMode = 'grid' | 'kanban' | 'list'

function InstancesMain() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const renderView = () => {
    switch (viewMode) {
      case 'grid':
        return <ScheduleGrid />
      case 'kanban':
        return <ScheduleKanban />
      case 'list':
        return <ScheduleList />
      default:
        return <ScheduleGrid />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with View Controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Daily Schedule Instances</h1>
        <div className="flex items-center space-x-4">
          {/* View Mode Selector */}
          <div className="flex items-center bg-secondary-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-secondary-900 shadow-sm'
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              <Squares2X2Icon className="h-4 w-4 mr-2" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white text-secondary-900 shadow-sm'
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              <CalendarDaysIcon className="h-4 w-4 mr-2" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-secondary-900 shadow-sm'
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              <ListBulletIcon className="h-4 w-4 mr-2" />
              List
            </button>
          </div>

          <Link to="/instances/create" className="btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Instance
          </Link>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <CalendarDaysIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-900">Large Scale Planning Tips</h3>
            <div className="mt-1 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Grid View:</strong> Best for weekly overview and drag-drop operations</li>
                <li><strong>Kanban View:</strong> Ideal for status-based workflow management</li>
                <li><strong>List View:</strong> Most efficient for searching and bulk operations</li>
                <li>Use filters to focus on specific regions, dates, or priorities</li>
                <li>Virtual scrolling ensures smooth performance with 400+ routes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Render Selected View */}
      {renderView()}
    </div>
  )
}

export default function InstancesPage() {
  return (
    <Routes>
      <Route index element={<InstancesMain />} />
      <Route path="create" element={<CreateScheduleInstancePage />} />
      <Route path="create/:scheduleId" element={<CreateScheduleInstancePage />} />
      {/* Add more routes for edit, view, etc. */}
    </Routes>
  )
}