import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin — defensively check header presence
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.slice(7).trim();
    const { data: { user: caller } } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }).auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin or gestor role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['admin', 'gestor']);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: 'Apenas administradores e gestores podem gerenciar usuários' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, email, password, displayName, role, userId, pin } = await req.json();

    if (action === 'create') {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });

      if (createError) {
        console.error('createUser error:', createError);
        const msg = (createError.message || '').toLowerCase();
        let userMessage = 'Não foi possível criar o usuário.';
        if (msg.includes('duplicate') || msg.includes('already') || msg.includes('registered')) {
          userMessage = 'Já existe um usuário com este e-mail.';
        } else if (msg.includes('password')) {
          userMessage = 'Senha inválida (mínimo 6 caracteres).';
        } else if (msg.includes('email')) {
          userMessage = 'E-mail inválido.';
        }
        return new Response(JSON.stringify({ error: userMessage }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (newUser.user && role) {
        await supabaseAdmin.from('user_roles').insert({
          user_id: newUser.user.id,
          role,
        });

        if (role === 'abastecedor') {
          await supabaseAdmin.from('fuel_pins').insert({
            user_id: newUser.user.id,
            pin: pin || '1234',
          });
        }
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update display name in profiles
      if (displayName) {
        await supabaseAdmin.from('profiles').update({ display_name: displayName }).eq('user_id', userId);
        // Also update auth user metadata
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { display_name: displayName },
        });
      }

      // Update password if provided
      if (password) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
        if (pwError) {
          console.error('updateUser password error:', pwError);
          return new Response(JSON.stringify({ error: 'Não foi possível atualizar a senha.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Update role if provided
      if (role) {
        // Remove existing roles and set new one
        await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
        await supabaseAdmin.from('user_roles').insert({ user_id: userId, role });

        // Handle PIN for abastecedor
        if (role === 'abastecedor') {
          const { data: existingPin } = await supabaseAdmin.from('fuel_pins').select('id').eq('user_id', userId).maybeSingle();
          if (!existingPin) {
            await supabaseAdmin.from('fuel_pins').insert({ user_id: userId, pin: pin || '1234' });
          } else if (pin) {
            await supabaseAdmin.from('fuel_pins').update({ pin }).eq('user_id', userId);
          }
        } else {
          // Remove PIN if no longer abastecedor
          await supabaseAdmin.from('fuel_pins').delete().eq('user_id', userId);
        }
      }

      // Update PIN independently (if role stays abastecedor)
      if (pin && !role) {
        const { data: existingPin } = await supabaseAdmin.from('fuel_pins').select('id').eq('user_id', userId).maybeSingle();
        if (existingPin) {
          await supabaseAdmin.from('fuel_pins').update({ pin }).eq('user_id', userId);
        } else {
          await supabaseAdmin.from('fuel_pins').insert({ user_id: userId, pin });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (userId === caller.id) {
        return new Response(JSON.stringify({ error: 'Você não pode excluir a si mesmo' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabaseAdmin.from('fuel_pins').delete().eq('user_id', userId);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('user_id', userId);

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
