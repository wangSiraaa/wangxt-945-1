import React, { useState, useEffect } from 'react';
import {
  Table, Tag, Button, Modal, Select, DatePicker, message, Empty,
  Row, Col, Card, Statistic, Descriptions, List, Divider, Spin,
} from 'antd';
import {
  AccountBookOutlined, PlusOutlined, CheckCircleOutlined,
  DollarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { settlementApi, departmentApi } from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export default function SettlementPage() {
  const [departments, setDepartments] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genModal, setGenModal] = useState(false);
  const [genDept, setGenDept] = useState(null);
  const [genRange, setGenRange] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [deptData, setData] = await Promise.all([
        departmentApi.list(),
        settlementApi.list(),
      ]);
      setDepartments(deptData);
      setSettlements(setData);
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!genDept || !genRange) return message.warning('请选择部门和日期范围');
    setGenerating(true);
    try {
      await settlementApi.generate({
        department_id: genDept,
        start_date: genRange[0],
        end_date: genRange[1],
      });
      message.success('结算单生成成功');
      setGenModal(false);
      setGenDept(null);
      setGenRange(null);
      loadData();
    } catch (err) {
      message.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async (id) => {
    Modal.confirm({
      title: '确认结算？',
      content: '确认后结算单状态将变更为已结算',
      onOk: async () => {
        try {
          await settlementApi.confirm(id);
          message.success('结算确认成功');
          loadData();
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const showDetail = async (id) => {
    setDetailModal(id);
    setDetailLoading(true);
    try {
      const data = await settlementApi.get(id);
      setDetailData(data);
    } catch (err) {
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: '结算单号',
      dataIndex: 'settlement_no',
      key: 'no',
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'dept',
    },
    {
      title: '日期范围',
      key: 'range',
      render: (_, r) => `${r.start_date} ~ ${r.end_date}`,
    },
    {
      title: '订单数',
      dataIndex: 'order_count',
      key: 'count',
      align: 'center',
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'amount',
      align: 'right',
      render: (v) => <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{v?.toFixed(2)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s) => (
        <Tag color={s === 'draft' ? 'blue' : s === 'settled' ? 'green' : 'default'} icon={s === 'settled' ? <CheckCircleOutlined /> : null}>
          {s === 'draft' ? '待确认' : s === 'settled' ? '已结算' : s}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'time',
      width: 170,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => showDetail(record.id)}>详情</Button>
          {record.status === 'draft' && (
            <Button type="primary" size="small" onClick={() => handleConfirm(record.id)}>
              确认
            </Button>
          )}
        </div>
      ),
    },
  ];

  const totalSettled = settlements.filter(s => s.status === 'settled').reduce((sum, s) => sum + s.total_amount, 0);
  const totalDraft = settlements.filter(s => s.status === 'draft').reduce((sum, s) => sum + s.total_amount, 0);

  return (
    <div>
      <div className="page-header">
        <h2><AccountBookOutlined /> 部门结算</h2>
        <p>按部门生成结算单并确认结算</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <div className="stat-card">
            <Statistic title="结算单总数" value={settlements.length} prefix={<FileTextOutlined />} />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stat-card">
            <Statistic title="待确认金额" value={totalDraft} prefix={<DollarOutlined />} suffix="元" valueStyle={{ color: '#fa8c16' }} />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stat-card">
            <Statistic title="已结算金额" value={totalSettled} prefix={<CheckCircleOutlined />} suffix="元" valueStyle={{ color: '#52c41a' }} />
          </div>
        </Col>
      </Row>

      <div className="card-container">
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <h3>结算单列表</h3>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenModal(true)}>
            生成结算单
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={settlements}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </div>

      <Modal
        title="生成结算单"
        open={genModal}
        onOk={handleGenerate}
        onCancel={() => setGenModal(false)}
        confirmLoading={generating}
        okText="生成"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>选择部门</div>
          <Select
            style={{ width: '100%' }}
            placeholder="选择部门"
            value={genDept}
            onChange={setGenDept}
            options={departments.map(d => ({ label: d.name, value: d.id }))}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>日期范围</div>
          <RangePicker
            style={{ width: '100%' }}
            onChange={(_, ds) => setGenRange(ds)}
          />
        </div>
      </Modal>

      <Modal
        title="结算单详情"
        open={!!detailModal}
        onCancel={() => { setDetailModal(null); setDetailData(null); }}
        footer={null}
        width={700}
      >
        {detailLoading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : detailData ? (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="结算单号">{detailData.settlement_no}</Descriptions.Item>
              <Descriptions.Item label="部门">{detailData.department_name}</Descriptions.Item>
              <Descriptions.Item label="日期范围">{detailData.start_date} ~ {detailData.end_date}</Descriptions.Item>
              <Descriptions.Item label="订单数">{detailData.order_count}</Descriptions.Item>
              <Descriptions.Item label="总金额" span={2}>
                <span style={{ color: '#f5222d', fontWeight: 700, fontSize: 18 }}>¥{detailData.total_amount?.toFixed(2)}</span>
              </Descriptions.Item>
            </Descriptions>

            <Divider>订单明细</Divider>

            <Table
              columns={[
                { title: '员工', dataIndex: 'employee_name', key: 'emp' },
                { title: '工号', dataIndex: 'employee_no', key: 'no' },
                { title: '订单号', dataIndex: 'order_no', key: 'ord' },
                { title: '日期', dataIndex: 'menu_date', key: 'date' },
                {
                  title: '餐次',
                  dataIndex: 'meal_type',
                  key: 'meal',
                  render: (v) => v === 'lunch' ? '午餐' : '晚餐',
                },
                { title: '订单金额', dataIndex: 'order_amount', key: 'amt', align: 'right', render: (v) => `¥${v?.toFixed(2)}` },
                { title: '取消费', dataIndex: 'cancel_fee', key: 'fee', align: 'right', render: (v) => v > 0 ? <span style={{ color: '#faad14' }}>¥{v.toFixed(2)}</span> : '-' },
                {
                  title: '合计',
                  dataIndex: 'total',
                  key: 'total',
                  align: 'right',
                  render: (v) => <b>¥{v?.toFixed(2)}</b>,
                },
              ]}
              dataSource={detailData.items}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}
