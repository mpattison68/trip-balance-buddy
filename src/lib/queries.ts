import { queryOptions } from "@tanstack/react-query";
import {
  getAccountData,
  listMembers,
  listCategories,
  listTrips,
  getTripDetail,
  listSettlements,
  getExpense,
} from "@/lib/data.functions";

export const accountDataQO = (accountId: string) =>
  queryOptions({
    queryKey: ["account", accountId],
    queryFn: () => getAccountData({ data: { accountId } }),
  });
export const membersQO = (accountId: string) =>
  queryOptions({
    queryKey: ["members", accountId],
    queryFn: () => listMembers({ data: { accountId } }),
  });
export const categoriesQO = (accountId: string) =>
  queryOptions({
    queryKey: ["categories", accountId],
    queryFn: () => listCategories({ data: { accountId } }),
  });
export const tripsQO = (accountId: string) =>
  queryOptions({
    queryKey: ["trips", accountId],
    queryFn: () => listTrips({ data: { accountId } }),
  });
export const tripDetailQO = (tripId: string) =>
  queryOptions({
    queryKey: ["trip", tripId],
    queryFn: () => getTripDetail({ data: { tripId } }),
  });
export const settlementsQO = (accountId: string) =>
  queryOptions({
    queryKey: ["settlements", accountId],
    queryFn: () => listSettlements({ data: { accountId } }),
  });
export const expenseQO = (id: string) =>
  queryOptions({
    queryKey: ["expense", id],
    queryFn: () => getExpense({ data: { id } }),
  });
