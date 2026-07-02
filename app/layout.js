import './generated.css';
import MobileTabBar from '@/components/MobileTabBar';

export const metadata = {
  title: 'frisbee-tactics-board · 飞盘战术板',
  description: '在线编辑飞盘（Frisbee / Ultimate Frisbee）战术：拖拽队员与飞盘、多页跑位补间、发布到战术广场。'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <MobileTabBar />
      </body>
    </html>
  );
}
