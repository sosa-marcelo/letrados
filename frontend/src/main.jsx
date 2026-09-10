import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import './estilos/tokens.css'
import './estilos/base.css'
import { enrutador } from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={enrutador} />
  </StrictMode>,
)
