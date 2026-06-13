import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Input, message, Empty, Segmented, Row, Col, Card, Badge } from 'antd';
import { CheckOutlined, CloseOutlined, AuditOutlined } from '@ant-design/icons';
import { approvalApi } from '../api';

export default function ApprovalPage() {
  const [status, setStatus] = useState('pending');
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadApprovals();
  }, [status]);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const data = await approvalApi.list({ status });
      setApprovals(data);
    } catch (err) {
      message.error('加载审批列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (record) => {
    try {
      await approvalApi.approve(record.id, { approved_by: 10 });
      message.success('审批通过');
      loadApprovals();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await approvalApi.reject(rejectModal.id, {
        approved_by: 10,
        reject_reason: rejectReason || '审批不通过',
      });
      message.success('已驳回');
      setRejectModal(null);
      setRejectReason('');
      loadApprovals();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    {
      title: '审批单号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 200,
    },
    {
      title: '员工',
      dataIndex: 'employee_name',
      key: 'employee',
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'dept',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{v?.toFixed(2)}</span>,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (v) => <Tag color="orange">{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s) => {
        const map = {
          pending: { color: 'orange', text: '待审批' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已驳回' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const item = map[s] || { color: 'default', text: s };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'time',
      width: 170,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) =>
        record.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record)}
            >
              通过
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setRejectModal(record)}
            >
              驳回
            </Button>
          </div>
        ) : (
          <span style={{ color: '#8c8c8c', fontSize: 12 }}>
            {record.approved_at ? new Date(record.approved_at).toLocaleString('zh-CN') : '-'}
          </span>
        ),
    },
  ];

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <div>
      <div className="page-header">
        <h2><AuditOutlined /> 审批管理</h2>
        <p>处理预算不足的订餐审批请求</p>
      </div>

      <div className="card-container">
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { label: <Badge count={status === 'pending' ? pendingCount : 0} size="small" offset={[6, -2]}>待审批</Badge>, value: 'pending' },
                { label: '已通过', value: 'approved' },
                { label: '已驳回', value: 'rejected' },
              ]}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={approvals}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无审批记录" /> }}
        />
      </div>

      <Modal
        title="驳回审批"
        open={!!rejectModal}
        onOk={handleReject}
        onCancel={() => { setRejectModal(null); setRejectReason(''); }}
        okText="确认驳回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 12 }}>
          订单号: <b>{rejectModal?.order_no}</b>
          {' · '}金额: <b style={{ color: '#f5222d' }}>¥{rejectModal?.amount?.toFixed(2)}</b>
        </div>
        <Input.TextArea
          rows={3}
          placeholder="请输入驳回原因"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
