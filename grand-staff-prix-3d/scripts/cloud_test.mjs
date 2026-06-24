import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://jicjlbsmlqmmjhtsgezz.supabase.co', 'sb_publishable_H7_nxUklCCA3ZMYro35v_Q_z-yiGK9v')
const ins = await sb.from('players').insert({ name: 'TESTBOT', class_code: 'ZZTEST', data: { xp: 999 } }).select().single()
console.log('insert:', ins.error ? 'ERROR ' + ins.error.message : 'ok id=' + ins.data.id)
const sel = await sb.from('players').select('name,data').eq('class_code', 'ZZTEST')
console.log('select:', sel.error ? 'ERROR ' + sel.error.message : JSON.stringify(sel.data))
if (ins.data) { await sb.from('players').delete().eq('id', ins.data.id); console.log('cleanup: deleted test row') }
