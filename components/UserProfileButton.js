'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Check, Upload } from 'lucide-react';
import { fetchCurrentUser, updateCurrentUser } from '@/lib/client-user';

const AVATAR_EMOJIS = ['🦅', '🐢', '🐺', '🦊', '🐼', '🐨', '🐯', '🐸', '🐙', '🦁', '🐬', '🦄', '🐱'];
const GENDERS = [
  { value: '', label: '未选择' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'alien', label: '外星人' },
  { value: 'other', label: '其他' }
];

const MAX_AVATAR_BYTES = 400 * 1024; // 400KB after compress

export default function UserProfileButton() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setUser(u))
      .finally(() => setLoading(false));
  }, []);

  const label = user?.nickname || '匿名';
  const avatar = user?.avatar || '🦅';
  const isImage = typeof avatar === 'string' && avatar.startsWith('data:');

  return (
    <>
      <button className="user-chip" onClick={() => setOpen(true)} aria-label="用户资料">
        <span className="user-chip__avatar">
          {isImage ? <img src={avatar} alt="" /> : avatar}
        </span>
        <span className="user-chip__name">{loading ? '…' : label}</span>
      </button>
      {open && (
        <ProfileModal
          user={user}
          onClose={() => setOpen(false)}
          onSaved={(next) => { setUser(next); setOpen(false); }}
        />
      )}
    </>
  );
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 128; // 头像最大边
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length * 0.75 > MAX_AVATAR_BYTES && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

function ProfileModal({ user, onClose, onSaved }) {
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [avatar, setAvatar] = useState(user?.avatar || AVATAR_EMOJIS[0]);
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const isCustomAvatar = typeof avatar === 'string' && avatar.startsWith('data:');

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('只能上传图片文件');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const dataUrl = await compressImage(file);
      setAvatar(dataUrl);
    } catch {
      setError('图片处理失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const trimmedPhone = phone.trim();
      if (trimmedPhone && !/^1\d{10}$/.test(trimmedPhone)) {
        setError('手机号格式不正确');
        setSaving(false);
        return;
      }
      const next = await updateCurrentUser({
        nickname: nickname.trim(),
        gender,
        avatar,
        phone: trimmedPhone
      });
      onSaved(next);
    } catch {
      setError('保存失败，请稍后再试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <strong>个人资料</strong>
          <button className="icon-button icon-button--subtle" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="modal__body">
          <div className="profile-field">
            <label>头像</label>
            <div className="avatar-current">
              <span className="avatar-current__preview">
                {isCustomAvatar ? <img src={avatar} alt="" /> : avatar}
              </span>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={14} />{uploading ? '处理中…' : '上传图片'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
            <div className="avatar-picker">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`avatar-picker__item${avatar === emoji ? ' avatar-picker__item--active' : ''}`}
                  onClick={() => setAvatar(emoji)}
                >{emoji}</button>
              ))}
            </div>
          </div>
          <div className="profile-field">
            <label>昵称（马甲）</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} placeholder="给自己起个名字" />
          </div>
          <div className="profile-field">
            <label>性别</label>
            <div className="gender-picker">
              {GENDERS.map((g) => (
                <button
                  key={g.value || 'none'}
                  type="button"
                  className={`gender-picker__item${gender === g.value ? ' gender-picker__item--active' : ''}`}
                  onClick={() => setGender(g.value)}
                >{g.label}</button>
              ))}
            </div>
          </div>
          <div className="profile-field">
            <label>手机号（选填）</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="设置后可跨浏览器识别同一账号" inputMode="tel" />
            <small>填了手机号后，在别的浏览器打开也用同一手机号，就是同一个账号。</small>
          </div>
          {error && <div className="profile-error">{error}</div>}
        </div>
        <footer className="modal__footer">
          <button className="button button--secondary" onClick={onClose}>取消</button>
          <button className="button button--primary" onClick={handleSave} disabled={saving}>
            <Check size={16} />{saving ? '保存中…' : '保存'}
          </button>
        </footer>
      </div>
    </div>
  );
}
