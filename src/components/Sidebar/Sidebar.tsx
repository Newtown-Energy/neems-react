import React, { useState, useEffect } from 'react';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Collapse sidebar by default on mobile
    if (window.innerWidth < 900) {
      setCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <aside id="sidebar" className={`${collapsed ? 'collapsed' : ''} ${className}`}>
      <div className="toggle-btn" id="sidebar-toggle" title="Expand/Collapse" onClick={toggleSidebar}>
        <i className={`bx ${collapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`}></i>
      </div>
      <h1 className="app-name">NEEMS</h1>
      <ul>
        <li className="active">
          <i className="bx bxs-dashboard active"></i> <span className="label">Overview</span>
        </li>
        <li>
          <i className="bx bxs-car-battery"></i> <span className="label">Bay 1</span>
        </li>
        <li>
          <i className="bx bxs-car-battery"></i> <span className="label">Bay 2</span>
        </li>
	<li>
          <img src="/con-edison.svg" alt="Con Edison" className="sidebar-icon" />
          <span className="label">Con Edison</span>
        </li>
	<li>
          <img src="/FDNY.svg" alt="FDNY" className="sidebar-icon" />
          <span className="label">FDNY</span>
        </li>
      </ul>
      <div className="logout-bar">
        <i className="bx bx-log-out"></i> <span className="label">Logout</span>
      </div>
    </aside>
  );
};

export default Sidebar;