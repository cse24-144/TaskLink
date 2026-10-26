revoke all on all sequences in schema public from authenticated;
grant usage on sequence public.job_job_id_seq, public.application_application_id_seq,
  public.message_message_id_seq, public.review_review_id_seq to authenticated;
