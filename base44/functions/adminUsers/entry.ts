import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Gestión manual de usuarios para el panel de administración.
// Solo administradores. Acciones: list, update, delete.
const EDITABLE = ['full_name', 'role', 'is_verified', 'disabled', 'disabled_reason'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autenticado' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const users = base44.asServiceRole.entities.User;

    if (action === 'list') {
      const items = await users.list('-created_date', 500);
      return Response.json({
        items: items.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          is_verified: !!u.is_verified,
          disabled: !!u.disabled,
          disabled_reason: u.disabled_reason || '',
          created_date: u.created_date,
          updated_date: u.updated_date,
        })),
      });
    }

    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return Response.json({ error: 'Falta el id del usuario' }, { status: 400 });

    if (action === 'update') {
      const data = {};
      for (const k of EDITABLE) {
        if (body.data && k in body.data) data[k] = body.data[k];
      }
      if (id === me.id && (data.role && data.role !== 'admin')) {
        return Response.json({ error: 'No puedes quitarte a ti mismo el rol de administrador.' }, { status: 400 });
      }
      if (id === me.id && data.disabled) {
        return Response.json({ error: 'No puedes desactivar tu propia cuenta.' }, { status: 400 });
      }
      if (Object.keys(data).length === 0) return Response.json({ error: 'Nada que cambiar' }, { status: 400 });
      const updated = await users.update(id, data);
      return Response.json({ ok: true, user: updated });
    }

    if (action === 'delete') {
      if (id === me.id) {
        return Response.json({ error: 'No puedes borrar tu propia cuenta desde aquí.' }, { status: 400 });
      }
      await users.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
