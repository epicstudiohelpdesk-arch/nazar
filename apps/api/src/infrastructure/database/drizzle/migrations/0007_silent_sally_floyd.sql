DELETE FROM "reports" a USING "reports" b
WHERE a.ctid > b.ctid
  AND a.reporter_user_id = b.reporter_user_id
  AND a.target_type = b.target_type
  AND a.target_id = b.target_id
  AND a.reason_code = b.reason_code
  AND a.status = 'OPEN';
--> statement-breakpoint
DROP INDEX "idx_reports_dedup";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reports_open_dedup" ON "reports" USING btree ("reporter_user_id","target_type","target_id","reason_code") WHERE status = 'OPEN';