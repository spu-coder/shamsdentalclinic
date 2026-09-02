ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_patient_profile_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_patient_profile_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.visits
  ADD CONSTRAINT visits_patient_profile_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.visit_media
  ADD CONSTRAINT visit_media_patient_profile_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.health_profiles
  ADD CONSTRAINT health_profiles_patient_profile_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;