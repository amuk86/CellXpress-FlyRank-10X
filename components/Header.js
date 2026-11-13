import Link from 'next/link';
import { useAuth } from './AuthProvider.js';
export default function Header() {
  const { user, logout } = useAuth();
  return <header className="masthead"><div><Link className="brand" href="/">CellXpress<span className="brand-dot">.</span></Link><div className="sub">Staff Workspace · UWC Student Centre</div></div><nav aria-label="Main navigation"><Link href="/">Dashboard</Link><Link href="/intake">+ New job</Link><button className="text-btn" onClick={logout}>Sign out</button></nav><div className="staff-label">{user?.email}</div></header>;
}
