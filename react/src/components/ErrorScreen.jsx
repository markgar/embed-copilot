import React from 'react'
import './ScreenStyles.css'

const ErrorScreen = ({ error }) => {
  return (
    <div className="error-screen">
      <h2>Error Loading Report</h2>
      <p className="error-message">{error}</p>
    </div>
  )
}

export default ErrorScreen