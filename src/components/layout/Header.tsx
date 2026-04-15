import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Settings, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui/Avatar'

interface HeaderProps {
  title: string
  onOpenMobile: () => void
}

export function Header({ title, onOpenMobile }: HeaderProps) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const displayName = profile?.full_name ?? user?.email ?? 'User'

  return (
    <header className="h-16 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenMobile}
          className="lg:hidden text-gray-400 hover:text-gray-200 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-100">{title}</h1>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
          <span className="hidden sm:block text-sm text-gray-300 max-w-[140px] truncate">{displayName}</span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-10">
            <div className="px-3 py-2 border-b border-gray-800">
              <p className="text-xs font-medium text-gray-100 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <Link
              to="/settings/profile"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
