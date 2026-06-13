import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  DatePicker,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import {
  orderApi,
  menuApi,
  wasteApi,
  canteenApi,
  prepApi,
} from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

const mealTypeMap = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

export default function CanteenPage() {
  const [activeTab, setActiveTab] = useState('verify');
  const [queryDate, setQueryDate] = useState(dayjs());
  const [mealType, setMealType] = useState('lunch');
  const [canteenId, setCanteenId] = useState();
  const [canteens, setCanteens] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dailyMenus, setDailyMenus] = useState([]);
  const [prepData, setPrepData] = useState({ items: [], department_summary: [] });
  const [wasteRecords, setWasteRecords] = useState([]);
  const [wasteQuery, setWasteQuery] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [loading, setLoading] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [substituteModalVisible, setSubstituteModalVisible] = useState(false);
  const [wasteForm] = Form.useForm();
  const [substituteForm] = Form.useForm();

  useEffect(() => {
    canteenApi.list().then(setCanteens).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'verify') {
      loadVerifyOrders();
    } else if (activeTab === 'prep') {
      loadPrepData();
      loadDailyMenus();
    } else if (activeTab === 'waste') {
      loadWasteRecords();
    }
  }, [activeTab, queryDate, mealType, canteenId]);

  const loadVerifyOrders = () => {
    setLoading(true);
    const params = {
      menu_date: queryDate.format('YYYY-MM-DD'),
      meal_type: mealType,
    };
    if (canteenId) params.canteen_id = canteenId;
    orderApi
      .list(params)
      .then((data) => {
        const filtered = data.filter(
          (o) => o.status === 'confirmed' && o.is_cancelled === 0
        );
        setOrders(filtered);
      })
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const loadPrepData = () => {
    setLoading(true);
    prepApi
      .list(queryDate.format('YYYY-MM-DD'), mealType)
      .then(setPrepData)
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const loadDailyMenus = () => {
    const params = {
      date: queryDate.format('YYYY-MM-DD'),
      meal_type: mealType,
    };
    if (canteenId) params.canteen_id = canteenId;
    menuApi.dailyList(params).then(setDailyMenus).catch(() => {});
  };

  const loadWasteRecords = () => {
    setLoading(true);
    const params = {};
    if (wasteQuery && wasteQuery[0]) params.start_date = wasteQuery[0].format('YYYY-MM-DD');
    if (wasteQuery && wasteQuery[1]) params.end_date = wasteQuery[1].format('YYYY-MM-DD');
    params.meal_type = mealType;
    wasteApi
      .list(params)
      .then(setWasteRecords)
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const handleVerify = (order) => {
    setCurrentOrder(order);
    setVerifyModalVisible(true);
  };

  const confirmVerify = () => {
    if (!currentOrder) return;
    setLoading(true);
    orderApi
      .verify(currentOrder.id, { verified_by: 1 })
      .then(() => {
        message.success('核销成功');
        setVerifyModalVisible(false);
        loadVerifyOrders();
      })
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const handleOpenWaste = (menu) => {
    wasteForm.resetFields();
    wasteForm.setFieldsValue({
      menu_id: menu.menu_id,
      daily_menu_id: menu.id,
      menu_name: menu.menu?.name || menu.menu_name,
      quantity: 1,
    });
    setWasteModalVisible(true);
  };

  const handleSubmitWaste = () => {
    wasteForm.validateFields().then((values) => {
      setLoading(true);
      wasteApi
        .create({ ...values, recorded_by: 1 })
        .then(() => {
          message.success('浪费记录已提交');
          setWasteModalVisible(false);
          loadDailyMenus();
          loadWasteRecords();
        })
        .catch((err) => message.error(err.message))
        .finally(() => setLoading(false));
    });
  };

  const handleOpenSubstitute = (record) => {
    setCurrentOrder(record);
    substituteForm.resetFields();
    setSubstituteModalVisible(true);
  };

  const handleSubmitSubstitute = () => {
    substituteForm.validateFields().then((values) => {
      if (!currentOrder) return;
      setLoading(true);
      const firstItem = currentOrder.items?.[0];
      if (!firstItem) {
        message.error('订单无餐品可替换');
        setLoading(false);
        return;
      }
      orderApi
        .substitute(currentOrder.id, {
          item_id: firstItem.id,
          new_daily_menu_id: values.new_daily_menu_id,
          reason: values.reason,
        })
        .then(() => {
          message.success('替餐成功');
          setSubstituteModalVisible(false);
          loadVerifyOrders();
        })
        .catch((err) => message.error(err.message))
        .finally(() => setLoading(false));
    });
  };

  const verifyColumns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
    },
    {
      title: '员工',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '餐别',
      dataIndex: 'meal_type',
      key: 'meal_type',
      width: 80,
      render: (t) => mealTypeMap[t] || t,
    },
    {
      title: '餐品',
      key: 'items',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {r.items?.map((item, idx) => (
            <div key={idx}>
              {item.menu_name} x{item.quantity}
              {item.is_substituted === 1 && (
                <Tag color="orange" style={{ marginLeft: 4 }}>
                  已替餐
                </Tag>
              )}
            </div>
          ))}
        </Space>
      ),
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 100,
      render: (v) => `¥${v?.toFixed?.(2) || v}`,
    },
    {
      title: '状态',
      key: 'verified',
      width: 100,
      render: (_, r) =>
        r.verified === 1 ? (
          <Tag color="success">已核销</Tag>
        ) : (
          <Tag color="warning">待核销</Tag>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, r) => (
        <Space>
          {r.verified !== 1 && (
            <>
              <Button type="primary" size="small" onClick={() => handleVerify(r)}>
                核销
              </Button>
              <Button size="small" onClick={() => handleOpenSubstitute(r)}>
                缺货替换
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const prepColumns = [
    {
      title: '餐品名称',
      dataIndex: 'menu_name',
      key: 'menu_name',
    },
    {
      title: '餐别',
      dataIndex: 'meal_type',
      key: 'meal_type',
      render: (t) => mealTypeMap[t] || t,
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      render: (v) => `¥${v?.toFixed?.(2) || v}`,
    },
    {
      title: '已订数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v, r) => (
        <span>
          <strong>{v}</strong> 份
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {r.order_count}单
          </Tag>
        </span>
      ),
    },
    {
      title: '预测备餐',
      key: 'predict',
      render: (_, r) => {
        const dm = dailyMenus.find((d) => d.menu_id === r.menu_id);
        return dm?.predict_qty ? `${dm.predict_qty} 份` : '-';
      },
    },
    {
      title: '当前库存',
      key: 'stock',
      render: (_, r) => {
        const dm = dailyMenus.find((d) => d.menu_id === r.menu_id);
        return dm ? (
          <span>
            {dm.stock} 份
            {dm.stock < r.quantity && (
              <Tag color="red" style={{ marginLeft: 8 }}>
                库存不足
              </Tag>
            )}
          </span>
        ) : (
          '-'
        );
      },
    },
    {
      title: '金额小计',
      key: 'subtotal',
      render: (_, r) => `¥${((r.price || 0) * (r.quantity || 0)).toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => {
        const dm = dailyMenus.find((d) => d.menu_id === r.menu_id);
        return dm ? (
          <Button size="small" danger onClick={() => handleOpenWaste(dm)}>
            记录浪费
          </Button>
        ) : null;
      },
    },
  ];

  const wasteColumns = [
    {
      title: '日期',
      dataIndex: 'menu_date',
      key: 'menu_date',
    },
    {
      title: '餐别',
      dataIndex: 'meal_type',
      key: 'meal_type',
      render: (t) => mealTypeMap[t] || t,
    },
    {
      title: '餐品',
      dataIndex: 'menu_name',
      key: 'menu_name',
    },
    {
      title: '浪费数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v) => `${v} 份`,
    },
    {
      title: '浪费金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v) => `¥${v?.toFixed?.(2) || v}`,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: '记录时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const verifiedCount = orders.filter((o) => o.verified === 1).length;
  const pendingCount = orders.filter((o) => o.verified !== 1).length;
  const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalWasteQty = wasteRecords.reduce((sum, w) => sum + (w.quantity || 0), 0);
  const totalWasteAmount = wasteRecords.reduce((sum, w) => sum + (w.amount || 0), 0);

  return (
    <div>
      <Card title="餐厅管理" bordered={false}>
        <Space style={{ marginBottom: 16 }} wrap>
          <DatePicker value={queryDate} onChange={setQueryDate} />
          <Select
            value={mealType}
            onChange={setMealType}
            style={{ width: 120 }}
            placeholder="选择餐别"
          >
            <Option value="breakfast">早餐</Option>
            <Option value="lunch">午餐</Option>
            <Option value="dinner">晚餐</Option>
          </Select>
          <Select
            value={canteenId}
            onChange={setCanteenId}
            style={{ width: 160 }}
            placeholder="选择食堂"
            allowClear
          >
            {canteens.map((c) => (
              <Option key={c.id} value={c.id}>
                {c.name}
              </Option>
            ))}
          </Select>
          {activeTab === 'waste' && (
            <RangePicker value={wasteQuery} onChange={setWasteQuery} />
          )}
          <Button type="primary" onClick={() => {
            if (activeTab === 'verify') loadVerifyOrders();
            else if (activeTab === 'prep') { loadPrepData(); loadDailyMenus(); }
            else if (activeTab === 'waste') loadWasteRecords();
          }}>
            查询
          </Button>
        </Space>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="取餐核销" key="verify">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card>
                  <Statistic title="订单总数" value={orders.length} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="待核销" value={pendingCount} valueStyle={{ color: '#faad14' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="已核销" value={verifiedCount} valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="订单总额" value={totalAmount} precision={2} prefix="¥" />
                </Card>
              </Col>
            </Row>
            <Table
              columns={verifyColumns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1000 }}
            />
          </Tabs.TabPane>

          <Tabs.TabPane tab="备餐预测" key="prep">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card>
                  <Statistic title="订单总数" value={prepData.total_orders || 0} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="菜品种类"
                    value={prepData.items?.length || 0}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="备餐总金额"
                    value={prepData.total_amount || 0}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="菜品备餐汇总" size="small" style={{ marginBottom: 16 }}>
              <Table
                columns={prepColumns}
                dataSource={prepData.items || []}
                rowKey="menu_id"
                loading={loading}
                pagination={false}
                size="small"
              />
            </Card>

            <Card title="部门订餐汇总" size="small">
              <Table
                columns={[
                  { title: '部门', dataIndex: 'department_name', key: 'department_name' },
                  { title: '订单数', dataIndex: 'order_count', key: 'order_count' },
                  {
                    title: '金额',
                    dataIndex: 'total_amount',
                    key: 'total_amount',
                    render: (v) => `¥${v?.toFixed?.(2) || v}`,
                  },
                ]}
                dataSource={prepData.department_summary || []}
                rowKey="department_id"
                pagination={false}
                size="small"
              />
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane tab="浪费统计" key="waste">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card>
                  <Statistic title="浪费记录数" value={wasteRecords.length} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="浪费总份数"
                    value={totalWasteQty}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="浪费总金额"
                    value={totalWasteAmount}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
            </Row>
            <Table
              columns={wasteColumns}
              dataSource={wasteRecords}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <Modal
        title="确认取餐核销"
        open={verifyModalVisible}
        onOk={confirmVerify}
        onCancel={() => setVerifyModalVisible(false)}
        confirmLoading={loading}
        width={500}
      >
        {currentOrder && (
          <div>
            <p><strong>订单号：</strong>{currentOrder.order_no}</p>
            <p><strong>员工：</strong>{currentOrder.employee_name}</p>
            <p><strong>部门：</strong>{currentOrder.department_name}</p>
            <p><strong>餐别：</strong>{mealTypeMap[currentOrder.meal_type]}</p>
            <p><strong>日期：</strong>{currentOrder.menu_date}</p>
            <div>
              <strong>餐品：</strong>
              <ul>
                {currentOrder.items?.map((item, idx) => (
                  <li key={idx}>
                    {item.menu_name} x{item.quantity} = ¥{item.subtotal?.toFixed?.(2) || item.subtotal}
                  </li>
                ))}
              </ul>
            </div>
            <p style={{ fontSize: 16, color: '#1677ff' }}>
              <strong>总金额：¥{currentOrder.total_amount?.toFixed?.(2)}</strong>
            </p>
          </div>
        )}
      </Modal>

      <Modal
        title="记录浪费"
        open={wasteModalVisible}
        onOk={handleSubmitWaste}
        onCancel={() => setWasteModalVisible(false)}
        confirmLoading={loading}
        width={450}
      >
        <Form form={wasteForm} layout="vertical">
          <Form.Item name="menu_name" label="餐品名称">
            <Input disabled />
          </Form.Item>
          <Form.Item name="quantity" label="浪费数量（份）" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="浪费原因" rules={[{ required: true, message: '请输入原因' }]}>
            <TextArea rows={3} placeholder="如：备餐过多、食材变质等" />
          </Form.Item>
          <Form.Item name="menu_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="daily_menu_id" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="缺货替餐"
        open={substituteModalVisible}
        onOk={handleSubmitSubstitute}
        onCancel={() => setSubstituteModalVisible(false)}
        confirmLoading={loading}
        width={500}
      >
        <Form form={substituteForm} layout="vertical">
          <Form.Item label="当前订单">
            <span>{currentOrder?.order_no} - {currentOrder?.employee_name}</span>
          </Form.Item>
          <Form.Item
            name="new_daily_menu_id"
            label="替换为餐品"
            rules={[{ required: true, message: '请选择替换餐品' }]}
          >
            <Select placeholder="选择可替换的餐品">
              {dailyMenus
                .filter((d) => d.stock > 0)
                .map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.menu?.name || d.menu_name} (库存:{d.stock}, ¥{d.menu?.price})
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="替换原因">
            <TextArea rows={2} placeholder="如：缺货、食材不足等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
