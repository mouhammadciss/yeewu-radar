-- Espace de démonstration : télécoms au Sénégal. Ne s'insère qu'une fois.
do $$
declare cid integer;
begin
  if not exists (select 1 from clients where name = 'Démo Télécoms Sénégal') then
    insert into clients (name, token)
    values ('Démo Télécoms Sénégal', 'demo-telecoms-' || substr(md5(random()::text), 1, 10))
    returning id into cid;

    insert into brands (client_id, name, is_own, color, keywords, excludes) values
      (cid, 'Orange Sénégal', true, '#FF7900',
        array['Orange Sénégal','Orange Senegal','Sonatel','Orange Money Sénégal','Orange Money'],
        array['jus d''orange','orange mécanique','Orange Côte d''Ivoire','Orange Mali']),
      (cid, 'Yas', false, '#7B3FE4',
        array['Yas Sénégal','Yas Senegal','Mixx by Yas','opérateur Yas','Free Sénégal'],
        array[]::text[]),
      (cid, 'Expresso', false, '#0A9E5B',
        array['Expresso Sénégal','Expresso Senegal','Expresso Telecom','opérateur Expresso'],
        array['café expresso','machine expresso']);
  end if;
end $$;
