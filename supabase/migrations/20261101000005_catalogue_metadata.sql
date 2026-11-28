alter table public.services
  add column if not exists category text not null default 'General',
  add column if not exists required_documents text[] not null default '{}',
  add column if not exists eligibility text,
  add column if not exists official_portal_url text,
  add column if not exists search_keywords text[] not null default '{}',
  add column if not exists is_active boolean not null default true;

update public.services
set is_active = is_published
where is_active is distinct from is_published;

alter table public.services
  add constraint services_portal_https_check
  check (official_portal_url is null or official_portal_url ~ '^https://[^[:space:]]+$');

alter table public.services
  add constraint services_category_length_check
  check (char_length(category) between 1 and 100);

alter table public.services
  add constraint services_description_length_check
  check (description is null or char_length(description) <= 2000);

alter table public.services
  add constraint services_eligibility_length_check
  check (eligibility is null or char_length(eligibility) <= 2000);

create index services_active_category_name_idx
  on public.services (category_id, name)
  where is_published and is_active;

create index services_recent_published_idx
  on public.services (created_at desc)
  where is_published and is_active;

create index services_keywords_idx
  on public.services using gin (search_keywords)
  where is_published and is_active;

insert into public.service_categories (name, slug, description, sort_order, is_published)
values
  ('Insurance Department', 'insurance', 'Insurance enquiry and application assistance. Insurance terms and eligibility are set by insurers.', 1, true),
  ('Revenue Department', 'revenue', 'Assistance with selected Jammu & Kashmir revenue services.', 2, true),
  ('Srinagar Municipal Corporation (SMC)', 'smc', 'Assistance with selected Srinagar Municipal Corporation services.', 3, true),
  ('Labour Department', 'labour', 'Assistance with selected labour and worker welfare services.', 4, true),
  ('Handloom & Handicrafts Department', 'handloom-handicrafts', 'Assistance with selected handloom and handicrafts services.', 5, true),
  ('RTO / Transport Department', 'rto-transport', 'Assistance with selected motor vehicle and transport services.', 6, true),
  ('Education Department', 'education', 'Assistance with selected education services.', 7, true),
  ('Social Welfare Department', 'social-welfare', 'Assistance with selected social welfare services.', 8, true),
  ('Employment Department', 'employment', 'Assistance with selected employment services.', 9, true),
  ('Health Department', 'health', 'Assistance with selected health services.', 10, true),
  ('Agriculture Department', 'agriculture', 'Assistance with selected agriculture services.', 11, true),
  ('Electricity Services', 'electricity', 'Assistance navigating selected electricity services.', 12, true),
  ('Water Supply Services', 'water-supply', 'Assistance navigating selected water supply services.', 13, true),
  ('Central Government Services', 'central-government', 'Assistance with selected central government services.', 14, true),
  ('Banking Assistance', 'banking', 'General assistance with selected banking services. Banking decisions remain with the bank.', 15, true),
  ('Railway and Bus Ticketing', 'ticketing', 'Assistance navigating official railway and bus ticketing channels.', 16, true),
  ('Other verified Jammu & Kashmir services', 'other-jk-services', 'Additional services published only after their details and official portal have been reviewed.', 17, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_published = excluded.is_published;

insert into public.services (
  category_id,
  name,
  category,
  description,
  required_documents,
  eligibility,
  official_portal_url,
  search_keywords,
  is_active,
  is_published,
  is_featured
)
select categories.id, seed.name, seed.category, seed.description,
       '{}'::text[], seed.eligibility, seed.official_portal_url, seed.search_keywords,
       true, true, seed.is_featured
from (values
  (
    'Central Government Services', 'Income tax e-Filing assistance', 'Tax services',
    'Assistance navigating the official Income Tax Department e-Filing portal.',
    'Confirm service availability and requirements on the official portal.',
    'https://www.incometax.gov.in/iec/foportal/', array['income tax', 'e-filing', 'tax', 'return'], true
  ),
  (
    'Health Department', 'ABHA account assistance', 'Digital health',
    'Assistance finding the official Ayushman Bharat Digital Mission information and access points.',
    'Refer to the official portal for current eligibility and identity requirements.',
    'https://abdm.gov.in/', array['abha', 'ayushman bharat', 'digital health', 'health account'], true
  ),
  (
    'Central Government Services', 'Udyam registration assistance', 'Enterprise registration',
    'Assistance navigating the Government of India Udyam Registration portal.',
    'Review the official portal for current enterprise and applicant requirements.',
    'https://udyamregistration.gov.in/', array['udyam', 'msme', 'enterprise', 'registration'], true
  ),
  (
    'Central Government Services', 'FSSAI portal assistance', 'Food safety',
    'Assistance locating official Food Safety and Standards Authority of India information and services.',
    'Confirm the appropriate application and requirements through the official portal.',
    'https://fssai.gov.in/', array['fssai', 'food safety', 'food business', 'licence'], false
  ),
  (
    'Labour Department', 'e-Shram portal assistance', 'Worker services',
    'Assistance navigating the Government of India e-Shram portal for unorganised workers.',
    'Confirm current registration eligibility and requirements on the official portal.',
    'https://eshram.gov.in/', array['e-shram', 'eshram', 'unorganised worker', 'labour'], true
  ),
  (
    'RTO / Transport Department', 'Learner licence portal assistance', 'Driving licence',
    'Assistance locating learner licence services on the Ministry of Road Transport and Highways Parivahan portal.',
    'Select the relevant state and confirm current requirements on the official portal.',
    'https://parivahan.gov.in/', array['learner licence', 'learner license', 'sarathi', 'driving licence'], true
  ),
  (
    'RTO / Transport Department', 'Driving licence portal assistance', 'Driving licence',
    'Assistance navigating driving licence information and services on the official Parivahan portal.',
    'Select the relevant state and confirm current requirements on the official portal.',
    'https://parivahan.gov.in/', array['driving licence', 'driving license', 'renewal', 'sarathi'], false
  ),
  (
    'RTO / Transport Department', 'Vehicle services portal assistance', 'Vehicle registration',
    'Assistance locating vehicle registration and related services on the official Parivahan portal.',
    'Select the relevant state and confirm current requirements on the official portal.',
    'https://parivahan.gov.in/', array['vehicle registration', 'rc', 'registration certificate', 'parivahan'], false
  )
) as seed(department_name, name, category, description, eligibility, official_portal_url, search_keywords, is_featured)
join public.service_categories categories on categories.name = seed.department_name
on conflict (category_id, name) do nothing;
