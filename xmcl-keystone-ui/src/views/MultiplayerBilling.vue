<template>
  <div class="grid w-full gap-4 px-4 pb-6 pt-2">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <v-icon color="primary">hub</v-icon>
          <h2 class="text-xl font-semibold">XMCL Together</h2>
        </div>
        <p class="mt-1 text-sm opacity-70">{{ t('multiplayer.billingDescription') }}</p>
      </div>
      <v-btn icon="refresh" variant="text" :loading="loading" @click="$emit('refresh')" />
    </div>

    <v-alert v-if="error" type="error" variant="tonal">
      {{ t('multiplayer.billingError') }}
    </v-alert>

    <div class="grid gap-3 md:grid-cols-2">
      <v-card variant="tonal" class="pa-4">
        <div class="text-xs font-semibold uppercase opacity-60">
          {{ t('multiplayer.availableBalance') }}
        </div>
        <div class="mt-2 text-3xl font-semibold">
          {{ overview ? formatMoney(overview.balance.available) : '—' }}
        </div>
        <div class="mt-1 text-xs opacity-60">{{ t('multiplayer.balanceHint') }}</div>
      </v-card>

      <v-card variant="tonal" class="pa-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase opacity-60">
              {{ t('multiplayer.trialTitle') }}
            </div>
            <div class="mt-2 text-lg font-semibold">{{ trialStatus }}</div>
            <div class="mt-1 text-xs opacity-60">
              {{ t('multiplayer.trialDescription') }}
            </div>
          </div>
          <v-btn
            v-if="overview?.trial.status === 'available'"
            color="primary"
            size="small"
            :loading="loading"
            @click="$emit('claim-trial')"
          >
            {{ t('multiplayer.tryTogether') }}
          </v-btn>
        </div>
      </v-card>
    </div>

    <v-card variant="outlined" class="pa-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="max-w-xl">
          <div class="text-xs font-semibold uppercase opacity-60">Together Home</div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-semibold">
              {{ overview ? formatMoney(overview.offer.monthlyPrice) : '$2.99' }}
            </span>
            <span class="text-sm opacity-60">/ {{ t('multiplayer.month') }}</span>
          </div>
          <p class="mt-2 text-sm opacity-70">{{ t('multiplayer.planDescription') }}</p>
          <p class="mt-2 text-xs opacity-60">{{ t('multiplayer.masterPurchaseHint') }}</p>
        </div>
        <div class="flex items-center gap-2">
          <v-chip
            v-if="overview?.subscription && overview.subscription.status !== 'cancelled'"
            :color="overview.subscription.status === 'active' ? 'success' : 'warning'"
            size="small"
          >
            {{ t(`multiplayer.subscription.${overview.subscription.status}`) }}
          </v-chip>
          <v-btn
            v-if="!overview?.subscription || overview.subscription.status === 'cancelled'"
            color="primary"
            :loading="loading"
            @click="$emit('subscribe')"
          >
            {{ t('multiplayer.buyTogether') }}
          </v-btn>
          <v-btn
            v-else-if="!overview.subscription.cancelAtPeriodEnd"
            variant="text"
            :loading="loading"
            @click="$emit('cancel')"
          >
            {{ t('multiplayer.cancelTogether') }}
          </v-btn>
        </div>
      </div>
    </v-card>

    <v-card variant="outlined" class="pa-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-48 flex-1">
          <div class="text-base font-semibold">{{ t('multiplayer.addFunds') }}</div>
          <div class="mt-1 text-xs opacity-60">{{ t('multiplayer.waffoHint') }}</div>
        </div>
        <v-text-field
          v-model.number="topUpAmount"
          class="max-w-40"
          density="compact"
          hide-details
          min="1"
          prefix="$"
          step="1"
          type="number"
          variant="outlined"
        />
        <v-btn
          color="primary"
          :disabled="!validTopUpAmount"
          :loading="loading"
          @click="$emit('top-up', Math.round(topUpAmount * 100))"
        >
          <v-icon start>open_in_new</v-icon>
          {{ t('multiplayer.checkout') }}
        </v-btn>
      </div>
      <v-alert v-if="order" class="mt-3" :type="order.status === 'completed' ? 'success' : 'info'" density="compact">
        {{ t('multiplayer.orderStatus', { status: order.status }) }}
      </v-alert>
    </v-card>

    <div class="flex flex-wrap items-center justify-between gap-3 px-1">
      <p class="min-w-48 flex-1 text-sm opacity-70">
        {{ t('multiplayer.refundHint') }}
      </p>
      <v-btn
        href="https://pancake.waffo.ai/consumer/portal/login"
        prepend-icon="open_in_new"
        target="browser"
        variant="text"
      >
        {{ t('multiplayer.openConsumerPortal') }}
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type {
  XmclTogetherMoney,
  XmclTogetherOrder,
  XmclTogetherOverview,
} from '@xmcl/runtime-api'

defineEmits<{
  refresh: []
  'claim-trial': []
  'top-up': [amountMinor: number]
  subscribe: []
  cancel: []
}>()

const props = defineProps<{
  overview?: XmclTogetherOverview
  order?: XmclTogetherOrder
  loading: boolean
  error?: unknown
}>()
const { t, locale } = useI18n()
const topUpAmount = ref(5)
const validTopUpAmount = computed(
  () => Number.isFinite(topUpAmount.value) && topUpAmount.value >= 1,
)
const trialStatus = computed(() => {
  const status = props.overview?.trial.status
  return status ? t(`multiplayer.trial.${status}`) : '—'
})

function formatMoney(money: XmclTogetherMoney) {
  const formatter = new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: money.currency,
  })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 0
  return formatter.format(money.amountMinor / 10 ** digits)
}
</script>