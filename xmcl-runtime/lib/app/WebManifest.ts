/* eslint-disable camelcase */

export interface WebManifest {
  /**
   * The background_color member describes the expected background color of the web application.
   */
  background_color?: string
  display?: string
  /**
   * The icons member is an array of icon objects that can serve as iconic representations of the web application in various contexts.
   */
  icons?: Array<{
    /**
     * The sizes member is a string consisting of an unordered set of unique space-separated tokens which are ASCII case-insensitive that represents the dimensions of an image for visual media.
     */
    sizes?: string | 'any'
    /**
     * The src member of an image is a URL from which a user agent can fetch the icon's data.
     */
    src: string
    /**
     * The type member of an image is a hint as to the media type of the image.
     */
    type?: string
    purpose?:
    | 'monochrome'
    | 'maskable'
    | 'any'
    | 'monochrome maskable'
    | 'monochrome any'
    | 'maskable monochrome'
    | 'maskable any'
    | 'any monochrome'
    | 'any maskable'
    | 'monochrome maskable any'
    | 'monochrome any maskable'
    | 'maskable monochrome any'
    | 'maskable any monochrome'
    | 'any monochrome maskable'
    | 'any maskable monochrome'
  }>
  /**
   * The name of the web application.
   */
  name?: string
  /**
   * A string that represents a short version of the name of the web application.
   */
  short_name?: string
  /**
   * Array of shortcut items that provide access to key tasks within a web application.
   */
  shortcuts?: Array<{
    /**
     * The name member of a shortcut item is a string that represents the name of the shortcut as it is usually displayed to the user in a context menu.
     */
    name: string
    /**
     * The short_name member of a shortcut item is a string that represents a short version of the name of the shortcut. It is intended to be used where there is insufficient space to display the full name of the shortcut.
     */
    short_name?: string
    /**
     * The description member of a shortcut item is a string that allows the developer to describe the purpose of the shortcut.
     */
    description?: string
    /**
     * The url member of a shortcut item is a URL within scope of a processed manifest that opens when the associated shortcut is activated.
     */
    url: string
    /**
     * The icons member of a shortcut item serves as iconic representations of the shortcut in various contexts.
     */
    icons?: Array<{
      /**
       * The sizes member is a string consisting of an unordered set of unique space-separated tokens which are ASCII case-insensitive that represents the dimensions of an image for visual media.
       */
      sizes?: string | 'any'
      /**
       * The src member of an image is a URL from which a user agent can fetch the icon's data.
       */
      src: string
      /**
       * The type member of an image is a hint as to the media type of the image.
       */
      type?: string
      purpose?:
      | 'monochrome'
      | 'maskable'
      | 'any'
      | 'monochrome maskable'
      | 'monochrome any'
      | 'maskable monochrome'
      | 'maskable any'
      | 'any monochrome'
      | 'any maskable'
      | 'monochrome maskable any'
      | 'monochrome any maskable'
      | 'maskable monochrome any'
      | 'maskable any monochrome'
      | 'any monochrome maskable'
      | 'any maskable monochrome'
    }>
  }>
  /**
   * Represents the URL that the developer would prefer the user agent load when the user launches the web application.
   */
  start_url?: string
  /**
   * The theme_color member serves as the default theme color for an application context.
   */
  theme_color?: string
  /**
  * Describes the expected application categories to which the web application belongs.
  */
  categories?: string[]
  /**
   * Description of the purpose of the web application
   */
  description?: string
  /**
   * The screenshots member is an array of image objects represent the web application in common usage scenarios.
   */
  screenshots?: Array<{
    /**
     * The sizes member is a string consisting of an unordered set of unique space-separated tokens which are ASCII case-insensitive that represents the dimensions of an image for visual media.
     */
    sizes?: string | 'any'
    /**
     * The src member of an image is a URL from which a user agent can fetch the icon's data.
     */
    src: string
    /**
     * The type member of an image is a hint as to the media type of the image.
     */
    type?: string
    purpose?:
    | 'monochrome'
    | 'maskable'
    | 'any'
    | 'monochrome maskable'
    | 'monochrome any'
    | 'maskable monochrome'
    | 'maskable any'
    | 'any monochrome'
    | 'any maskable'
    | 'monochrome maskable any'
    | 'monochrome any maskable'
    | 'maskable monochrome any'
    | 'maskable any monochrome'
    | 'any monochrome maskable'
    | 'any maskable monochrome'
  }>
}
