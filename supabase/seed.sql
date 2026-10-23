-- Optional local-only data. Every value is fictitious and uses the reserved
-- .invalid domain so no message can reach a real recipient.

insert into public.profissionais (nome, email, telefone, ativo)
values ('Profissional Exemplo', 'profissional@example.invalid', '11000000000', 1)
on conflict do nothing;

insert into public.disponibilidades
  (profissional_id, dia_semana, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo)
select id, dia, time '09:00', time '12:00', 50, 10, 1
from public.profissionais
cross join (values (1), (2), (3), (4), (5)) as dias(dia)
where email = 'profissional@example.invalid'
on conflict do nothing;
