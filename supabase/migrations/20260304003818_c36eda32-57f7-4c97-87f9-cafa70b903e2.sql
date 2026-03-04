ALTER TABLE public.obras
  ADD COLUMN contract_number text,
  ADD COLUMN client text,
  ADD COLUMN cnpj text,
  ADD COLUMN start_date date,
  ADD COLUMN expected_end_date date;