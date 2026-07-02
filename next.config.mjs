/*
 * @Author: skye 3016218068@tju.edu.cn
 * @Date: 2026-07-01 14:45:45
 * @LastEditors: skye 3016218068@tju.edu.cn
 * @LastEditTime: 2026-07-02 16:01:46
 * @FilePath: /frisbee-tactics-board/next.config.mjs
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};

export default nextConfig;
