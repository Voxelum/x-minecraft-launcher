export function useTutorial() {
  const { t } = useI18n()
  async function start() {
    const { driver } = await import('driver.js')
    await import('driver.js/dist/driver.css')
    await import('../assets/driver.css')
    const driverObj = driver({
      popoverClass: 'driverjs-theme',
      nextBtnText: t('next'),
      animate: true,
      allowClose: false,
      prevBtnText: t('previous'),
      doneBtnText: 'OK!',
      steps: [
        { element: '#user-avatar', popover: { title: t('userAccount.add'), description: t('tutorial.userAccountDescription') } },
        { element: '#create-instance-button', popover: { title: t('instances.add'), description: t('tutorial.instanceAddDescription') } },
        { element: '#launch-button', popover: { title: t('launch.launch'), description: t('tutorial.launchDescription') } },
        { element: '#feedback-button', popover: { title: t('feedback.name'), description: t('tutorial.feedbackDescription') } },
      ],
    })
    driverObj.drive()
  }

  return {
    start,
  }
}
