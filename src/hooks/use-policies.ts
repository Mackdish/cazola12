import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  adminCreatePolicy,
  adminDeletePolicy,
  adminUpdatePolicy,
  fetchAllPolicies,
  fetchPolicyById,
  fetchPolicyBySlugPublic,
  fetchPublishedPolicies,
  searchPoliciesPublicFn,
} from "@/lib/policy.functions";

export function usePublishedPolicies() {
  const fn = useServerFn(fetchPublishedPolicies);
  return useQuery({
    queryKey: ["policies", "published"],
    queryFn: () => fn(),
  });
}

export function usePolicyBySlug(slug: string | null) {
  const fn = useServerFn(fetchPolicyBySlugPublic);
  return useQuery({
    queryKey: ["policies", "slug", slug],
    enabled: Boolean(slug),
    queryFn: () => fn({ data: { slug: slug! } }),
  });
}

export function useAllPolicies() {
  const fn = useServerFn(fetchAllPolicies);
  return useQuery({
    queryKey: ["policies", "all"],
    queryFn: () => fn(),
  });
}

export function usePolicyById(policyId: string | null) {
  const fn = useServerFn(fetchPolicyById);
  return useQuery({
    queryKey: ["policies", "id", policyId],
    enabled: Boolean(policyId),
    queryFn: () => fn({ data: { policyId: policyId! } }),
  });
}

export function useAdminCreatePolicy() {
  const fn = useServerFn(adminCreatePolicy);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      category: string;
      slug: string;
      title: string;
      description: string;
      sections?: unknown[];
      relatedPolicies?: string[];
      isPublished?: boolean;
    }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useAdminUpdatePolicy() {
  const fn = useServerFn(adminUpdatePolicy);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      policyId: string;
      category?: string;
      slug?: string;
      title?: string;
      description?: string;
      sections?: unknown[];
      relatedPolicies?: string[];
      isPublished?: boolean;
    }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useAdminDeletePolicy() {
  const fn = useServerFn(adminDeletePolicy);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: string) => fn({ data: { policyId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useSearchPolicies() {
  const fn = useServerFn(searchPoliciesPublicFn);
  return useMutation({
    mutationFn: (query: string) => fn({ data: { query } }),
  });
}
