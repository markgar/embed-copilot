import React from 'react'
import './ScreenStyles.css'

const LoadingScreen = ({ debugInfo }) => {
  return (
    <div className="loading-screen">
      <h2>Loading Power BI Report...</h2>
      <p>Debug: {debugInfo}</p>
    </div>
  )
}

export default LoadingScreen