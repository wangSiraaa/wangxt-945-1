import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  AuditOutlined,
  CoffeeOutlined,
  AccountBookOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  DiffOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import MenuPage from './pages/MenuPage';
import OrderPage from './pages/OrderPage';
import ApprovalPage from './pages/ApprovalPage';
import PrepListPage from './pages/PrepListPage';
import SettlementPage from './pages/SettlementPage';
import BudgetPage from './pages/BudgetPage';
import CanteenPage from './pages/CanteenPage';
import FinancePage from './pages/FinancePage';
import FinanceTracePage from './pages/FinanceTracePage';

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/menu', icon: <ShopOutlined />, label: '菜单浏览' },
  { key: '/order', icon: <ShoppingCartOutlined />, label: '员工订餐' },
  { key: '/approval', icon: <AuditOutlined />, label: '审批管理' },
  { key: '/prep', icon: <CoffeeOutlined />, label: '备餐清单' },
  { key: '/canteen', icon: <CheckCircleOutlined />, label: '餐厅管理' },
  { key: '/settlement', icon: <AccountBookOutlined />, label: '部门结算' },
  { key: '/finance', icon: <DiffOutlined />, label: '财务对账' },
  { key: '/finance-trace', icon: <AccountBookOutlined />, label: '财务追溯' },
  { key: '/budget', icon: <WalletOutlined />, label: '预算监控' },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-logo">
          <h2>🍽 团餐订餐</h2>
          <p>结算管理系统</p>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          theme="dark"
        />
      </div>
      <div className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/order" element={<OrderPage />} />
          <Route path="/approval" element={<ApprovalPage />} />
          <Route path="/prep" element={<PrepListPage />} />
          <Route path="/canteen" element={<CanteenPage />} />
          <Route path="/settlement" element={<SettlementPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/finance-trace" element={<FinanceTracePage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}
