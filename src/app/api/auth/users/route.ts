import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma.ts';
import {
  findUser,
  hashPassword,
  verifySessionToken,
  SESSION_COOKIE,
} from '@/lib/auth.ts';
import {
  SPARTA_ROLES,
  PROFILE_BY_USERNAME,
  DEFAULT_PROFILE,
} from '@/lib/profileMeta.ts';

export const dynamic = 'force-dynamic';

const CUSTOM_PROFILES_FILE = path.join(process.cwd(), 'src', 'lib', 'custom_user_profiles.json');

function getCustomProfiles() {
  try {
    if (fs.existsSync(CUSTOM_PROFILES_FILE)) {
      const data = fs.readFileSync(CUSTOM_PROFILES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (_) {}
  return {};
}

function saveCustomProfiles(profiles) {
  try {
    fs.writeFileSync(CUSTOM_PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  } catch (_) {}
}

async function getCallerUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const username = verifySessionToken(token);
  if (!username) return null;
  const user = await findUser(username);
  if (!user) return null;

  const custom = getCustomProfiles();
  const meta = custom[user.username] || PROFILE_BY_USERNAME[user.username] || DEFAULT_PROFILE;
  return { ...user, roleId: meta.roleId || 'admin' };
}

/**
 * GET: Mengambil daftar seluruh user terdaftar
 */
export async function GET() {
  try {
    const dbUsers = await prisma.appUser.findMany({
      select: {
        username: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const customProfiles = getCustomProfiles();

    const users = dbUsers.map((u) => {
      const meta = customProfiles[u.username] || PROFILE_BY_USERNAME[u.username] || DEFAULT_PROFILE;
      const roleInfo = SPARTA_ROLES[meta.roleId] || SPARTA_ROLES.admin;
      const isSystemAccount = ['admin', 'valens'].includes(u.username);

      return {
        username: u.username,
        displayName: u.displayName,
        createdAt: u.createdAt,
        roleId: meta.roleId || 'admin',
        roleName: roleInfo.name,
        badgeColor: roleInfo.badgeColor,
        roleTitle: meta.role || roleInfo.badge,
        nip: meta.nip || '—',
        dept: meta.dept || 'Dept. Energy Management & ESG',
        division: meta.division || 'Operation & Property Division',
        isSystemAccount,
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('[auth/users] GET error:', error?.message);
    return NextResponse.json({ success: false, error: 'Gagal memuat daftar pengguna.' }, { status: 500 });
  }
}

/**
 * POST: Menambahkan user baru (Khusus Super Admin)
 */
export async function POST(request) {
  try {
    const caller = await getCallerUser(request);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Sesi tidak valid.' }, { status: 401 });
    }
    if (caller.roleId !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya Admin Super yang berwenang menambahkan pengguna baru.' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const rawPassword = String(body.password || '').trim();
    const roleId = String(body.roleId || 'admin').trim();
    const nip = String(body.nip || '').trim() || `ALFA-${Math.floor(10000 + Math.random() * 90000)}-USR`;
    const dept = String(body.dept || '').trim() || 'Dept. Energy Management & ESG';
    const division = String(body.division || '').trim() || 'Operation & Property Division';

    if (!username || !displayName) {
      return NextResponse.json(
        { success: false, error: 'Username dan Nama Lengkap wajib diisi.' },
        { status: 400 },
      );
    }

    // Same minimum as /api/auth/change-password; there is no shared default password any more.
    if (rawPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password awal minimal 8 karakter.' },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username harus 3-30 karakter (hanya huruf kecil, angka, atau underscore).' },
        { status: 400 },
      );
    }

    if (!SPARTA_ROLES[roleId]) {
      return NextResponse.json(
        { success: false, error: 'Role yang dipilih tidak valid.' },
        { status: 400 },
      );
    }

    // Cek apakah username sudah terdaftar di database
    const existing = await findUser(username);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Username @${username} sudah terdaftar.` },
        { status: 409 },
      );
    }

    // Buat di DB PostgreSQL
    const passwordHash = hashPassword(rawPassword);
    await prisma.appUser.create({
      data: {
        username,
        displayName,
        passwordHash,
      },
    });

    // Simpan metadata profil ke custom registry
    const customProfiles = getCustomProfiles();
    const roleInfo = SPARTA_ROLES[roleId];
    customProfiles[username] = {
      nip,
      roleId,
      role: displayName.includes('Manager') ? displayName : `${roleInfo.badge} - ${displayName}`,
      dept,
      division,
      headOffice: 'Alfa Tower lt. 19, Tangerang',
      joinYear: String(new Date().getFullYear()),
    };
    saveCustomProfiles(customProfiles);

    return NextResponse.json({
      success: true,
      message: `Pengguna @${username} berhasil didaftarkan. Sampaikan password awal secara langsung dan minta pengguna menggantinya setelah login.`,
      user: {
        username,
        displayName,
        roleId,
        roleName: roleInfo.name,
        nip,
        dept,
      },
    });
  } catch (error) {
    console.error('[auth/users] POST error:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Gagal menambahkan pengguna: ' + (error?.message || 'Kesalahan server') },
      { status: 500 },
    );
  }
}

/**
 * DELETE: Menghapus user (Khusus Super Admin)
 */
export async function DELETE(request) {
  try {
    const caller = await getCallerUser(request);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Sesi tidak valid.' }, { status: 401 });
    }
    if (caller.roleId !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya Admin Super yang berwenang menghapus pengguna.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUsername = String(searchParams.get('username') || '').trim().toLowerCase();

    if (!targetUsername) {
      return NextResponse.json({ success: false, error: 'Username target tidak disertakan.' }, { status: 400 });
    }

    if (['admin', 'valens'].includes(targetUsername)) {
      return NextResponse.json(
        { success: false, error: 'Akun sistem inti tidak dapat dihapus.' },
        { status: 403 },
      );
    }

    await prisma.appUser.deleteMany({
      where: { username: targetUsername },
    });

    const customProfiles = getCustomProfiles();
    delete customProfiles[targetUsername];
    saveCustomProfiles(customProfiles);

    return NextResponse.json({
      success: true,
      message: `Akun @${targetUsername} berhasil dihapus.`,
    });
  } catch (error) {
    console.error('[auth/users] DELETE error:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus pengguna.' },
      { status: 500 },
    );
  }
}
