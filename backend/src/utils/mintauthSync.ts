/**
 * Utility functions to sync users with MintAuth
 */

const MINTAUTH_URL = process.env.MINTAUTH_URL || 'http://mintauth-backend:8000';

interface CreateUserInMintAuthParams {
  username: string;
  email?: string;
  password: string;
  role: string;
  adminToken?: string; // JWT token from current admin user
}

interface UpdateUserInMintAuthParams {
  username: string;
  email?: string;
  role?: string;
  adminToken?: string;
}

/**
 * Create user in MintAuth
 */
export async function createUserInMintAuth(params: CreateUserInMintAuthParams): Promise<void> {
  const { username, email, password, role, adminToken } = params;

  if (!adminToken) {
    console.warn('⚠️  No admin token provided, skipping MintAuth user creation');
    return;
  }

  try {
    // Map FeedbackATM roles to MintAuth project roles
    // ADMIN -> ADMIN (is_admin=true)
    // MANAGER -> MANAGER
    // CLEANER -> CLEANER
    const isAdmin = role === 'ADMIN';
    const projectRole = isAdmin ? undefined : role; // Admins don't need project assignments

    const userData: any = {
      username,
      password,
      email: email || undefined,
      is_admin: isAdmin,
      is_active: true,
      projects: projectRole ? [{ project_name: 'FeedbackATM', role: projectRole }] : []
    };

    const response = await fetch(`${MINTAUTH_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to create user in MintAuth: ${response.status} ${errorText}`);
      // Don't throw - allow user creation in FeedbackATM to succeed even if MintAuth fails
      return;
    }

    console.log(`✅ User '${username}' created in MintAuth`);
  } catch (error: any) {
    console.error(`❌ Error creating user in MintAuth: ${error.message}`);
    // Don't throw - allow user creation in FeedbackATM to succeed even if MintAuth fails
  }
}

/**
 * Update user in MintAuth
 */
export async function updateUserInMintAuth(params: UpdateUserInMintAuthParams): Promise<void> {
  const { username, email, role, adminToken } = params;

  if (!adminToken) {
    console.warn('⚠️  No admin token provided, skipping MintAuth user update');
    return;
  }

  try {
    // Get list of all users from MintAuth and find the one we need
    const getUserResponse = await fetch(`${MINTAUTH_URL}/admin/users?limit=1000`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!getUserResponse.ok) {
      console.warn(`⚠️  Failed to fetch users from MintAuth, skipping update`);
      return;
    }

    const users = await getUserResponse.json();
    const user = Array.isArray(users) 
      ? users.find((u: any) => u.username === username)
      : null;

    if (!user) {
      console.warn(`⚠️  User '${username}' not found in MintAuth, skipping update`);
      return;
    }

    const userId = user.id;

    // Update user data
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) {
      const isAdmin = role === 'ADMIN';
      updateData.is_admin = isAdmin;
      // Update project role if not admin
      if (!isAdmin) {
        // Update user projects
        await fetch(`${MINTAUTH_URL}/admin/users/${userId}/projects`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            projects: [{ project_name: 'FeedbackATM', role }]
          })
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      const response = await fetch(`${MINTAUTH_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to update user in MintAuth: ${response.status} ${errorText}`);
        return;
      }

      console.log(`✅ User '${username}' updated in MintAuth`);
    }
  } catch (error: any) {
    console.error(`❌ Error updating user in MintAuth: ${error.message}`);
    // Don't throw - allow user update in FeedbackATM to succeed even if MintAuth fails
  }
}

/**
 * Delete user from MintAuth
 */
export async function deleteUserFromMintAuth(username: string, adminToken?: string): Promise<void> {
  if (!adminToken) {
    console.warn('⚠️  No admin token provided, skipping MintAuth user deletion');
    return;
  }

  try {
    // Get list of all users from MintAuth and find the one we need
    const getUserResponse = await fetch(`${MINTAUTH_URL}/admin/users?limit=1000`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!getUserResponse.ok) {
      console.warn(`⚠️  Failed to fetch users from MintAuth, skipping deletion`);
      return;
    }

    const users = await getUserResponse.json();
    const user = Array.isArray(users) 
      ? users.find((u: any) => u.username === username)
      : null;

    if (!user) {
      console.warn(`⚠️  User '${username}' not found in MintAuth, skipping deletion`);
      return;
    }

    const userId = user.id;

    const response = await fetch(`${MINTAUTH_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to delete user from MintAuth: ${response.status} ${errorText}`);
      return;
    }

    console.log(`✅ User '${username}' deleted from MintAuth`);
  } catch (error: any) {
    console.error(`❌ Error deleting user from MintAuth: ${error.message}`);
    // Don't throw - allow user deletion in FeedbackATM to succeed even if MintAuth fails
  }
}

/**
 * Extract JWT token from request headers
 */
export function getTokenFromRequest(req: any): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // Also check cookies
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc: any, cookie: string) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    return cookies['mint_session'];
  }

  return undefined;
}

