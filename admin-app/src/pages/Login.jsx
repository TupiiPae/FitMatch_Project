import { Form, Input, Button, message } from 'antd';
import { api } from '../lib/api';

export default function Login() {
  const onFinish = async (values) => {
    try {
      const { data } = await api.post('/auth/login', values);
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.user.role);
      window.location.href = '/';
    } catch {
      message.error('Đăng nhập thất bại');
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h2>Admin Login</h2>
      <Form onFinish={onFinish} layout="vertical">
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}>
          <Input.Password />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>Đăng nhập</Button>
      </Form>
    </div>
  );
}
