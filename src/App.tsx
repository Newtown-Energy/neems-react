import React from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import './App.scss';

const App: React.FC = () => {
  return (
    <div className="body-content">
      <Sidebar />
      <div className="overview">
        <header>
          <div><span className="avatar">A</span> Admin</div>
        </header>
        <main>
          <h2>Overview</h2>
          <div className="grid-stack">
            <div
              className="grid-stack-item"
              data-gs-x="0"
              data-gs-y="0"
              data-gs-w="4"
              data-gs-min-w="2"
            >
              <div className="grid-stack-item-content revenue">
                <p className="description">Monthly flibbers</p>
                <p className="metric-value">1,018</p>
              </div>
            </div>
            <div
              className="grid-stack-item"
              data-gs-x="4"
              data-gs-y="0"
              data-gs-w="4"
              data-gs-min-w="2"
            >
              <div className="grid-stack-item-content customer-overview">
                <p className="description">Total Whatchamacallits</p>
                <p className="metric-value">5,133</p>
              </div>
            </div>
            <div
              className="grid-stack-item"
              data-gs-x="8"
              data-gs-y="0"
              data-gs-w="4"
              data-gs-min-w="2"
            >
              <div className="grid-stack-item-content growth">
                <p className="description">TSLA share price </p>
                <p className="metric-value profit">
                  <i className="bx bxs-down-arrow-circle"></i> 22.8%
                </p>
              </div>
            </div>
            <div
              className="grid-stack-item"
              data-gs-x="0"
              data-gs-y="1"
              data-gs-w="7"
              data-gs-h="2"
              data-gs-min-w="5"
              data-gs-min-h="2"
            >
              <div className="grid-stack-item-content transactions-overview">
                <p className="description">Latest Alarms</p>
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Magnitude</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Sensor 1 over temp</td>
                      <td>165&deg;F</td>
                      <td>Alerted via email</td>
                      <td>2025-04-08 12:04:00 UTC-4</td>
                    </tr>
                    <tr>
                      <td>Sensor 1 over temp</td>
                      <td>158&deg;F</td>
                      <td>Alerted via email</td>
                      <td>2025-04-08 12:03:00 UTC-4</td>
                    </tr>
                    <tr>
                      <td>Sensor 1 over temp</td>
                      <td>153&deg;F</td>
                      <td>Alerted via email</td>
                      <td>2025-04-08 12:02:00 UTC-4</td>
                    </tr>
                    <tr>
                      <td>Sensor 1 over temp</td>
                      <td>151&deg;F</td>
                      <td>Alerted via email</td>
                      <td>2025-04-08 12:01:00 UTC-4</td>
                    </tr>
                    <tr>
                      <td>Sensor 1 over temp</td>
                      <td>150&deg;F</td>
                      <td>Alerted via email</td>
                      <td>2025-04-08 12:00:00 UTC-4</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div
              className="grid-stack-item"
              data-gs-x="7"
              data-gs-y="1"
              data-gs-w="5"
              data-gs-min-w="2"
            >
              <div className="grid-stack-item-content top-customers">
                <p className="description">System Maintenance Checklist</p>
                <ul className="customers">
                  <li className="customer">
                    Upgrades <i className="bx bxs-badge-check"></i>
                  </li>
                  <li className="customer">
                    Patches <i className="bx bxs-badge-check"></i>
                  </li>
                  <li className="customer">
                    Backup <i className="bx bxs-badge-check"></i>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;