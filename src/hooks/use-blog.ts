import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  adminCreateBlogPost,
  adminDeleteBlogPost,
  adminUpdateBlogPost,
  fetchAllBlogPosts,
  fetchPublishedBlogPosts,
} from "@/lib/blog.functions";

export function usePublishedBlogPosts() {
  const fn = useServerFn(fetchPublishedBlogPosts);
  return useQuery({ queryKey: ["blog", "published"], queryFn: () => fn() });
}

export function useAllBlogPosts() {
  const fn = useServerFn(fetchAllBlogPosts);
  return useQuery({ queryKey: ["blog", "all"], queryFn: () => fn() });
}

export function useAdminCreateBlogPost() {
  const fn = useServerFn(adminCreateBlogPost);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blog"] });
    },
  });
}

export function useAdminUpdateBlogPost() {
  const fn = useServerFn(adminUpdateBlogPost);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blog"] });
    },
  });
}

export function useAdminDeleteBlogPost() {
  const fn = useServerFn(adminDeleteBlogPost);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blogPostId: string) => fn({ data: { blogPostId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blog"] });
    },
  });
}
