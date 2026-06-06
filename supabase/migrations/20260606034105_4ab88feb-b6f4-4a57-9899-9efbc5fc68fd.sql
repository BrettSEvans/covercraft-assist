
DROP POLICY IF EXISTS "Authenticated users can insert blocked sites" ON public.blocked_scrape_sites;
DROP POLICY IF EXISTS "Authenticated users can update blocked sites" ON public.blocked_scrape_sites;
DROP POLICY IF EXISTS "Authenticated users can delete blocked sites" ON public.blocked_scrape_sites;

CREATE POLICY "Admins can insert blocked sites" ON public.blocked_scrape_sites
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update blocked sites" ON public.blocked_scrape_sites
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete blocked sites" ON public.blocked_scrape_sites
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can CRUD story templates" ON public.story_templates;
CREATE POLICY "Authenticated users can read story templates" ON public.story_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert story templates" ON public.story_templates
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update story templates" ON public.story_templates
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete story templates" ON public.story_templates
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Allow all access to dashboard-assets" ON storage.objects;
CREATE POLICY "Public can read dashboard-assets" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'dashboard-assets');
CREATE POLICY "Authenticated users can upload dashboard-assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dashboard-assets');
CREATE POLICY "Authenticated users can update dashboard-assets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'dashboard-assets') WITH CHECK (bucket_id = 'dashboard-assets');
CREATE POLICY "Authenticated users can delete dashboard-assets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'dashboard-assets');

DROP POLICY IF EXISTS "Users can delete own resume files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resume" ON storage.objects;
CREATE POLICY "Users can update own resume" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resume-uploads' AND (storage.foldername(name))[1] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'resume-uploads' AND (storage.foldername(name))[1] = (auth.uid())::text);
