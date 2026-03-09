DELETE FROM work_orders WHERE maintenance_request_id IN (SELECT id FROM maintenance_requests WHERE operator_name = 'Teste2');
DELETE FROM maintenance_requests WHERE operator_name = 'Teste2';