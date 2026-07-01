import { FaIcon } from '../components/FaIcon'
import { APP_NAME } from '../appName'

function AuthWrapper({title, children}) {
  return (
    <div className="shell">
    <div className="card login-card">
      <div className="login-brand">
        <div className="login-logo">
          <FaIcon icon="store" className="login-logo-fa" />
        </div>
        <div>
          <p className="login-eyebrow">{APP_NAME}</p>
          <h1 className="login-title">
            {title}
          </h1>
        </div>
      </div>
      {children}
      </div>
    </div>
  )
}

export default AuthWrapper