CREATE TABLE `Notification` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `channelId` VARCHAR(191) NOT NULL,
  `guildId`   VARCHAR(191) NOT NULL,
  `city`      VARCHAR(191) NOT NULL,
  `state`     VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Notification_channelId_city_state_key` (`channelId`, `city`, `state`),
  INDEX `Notification_city_state_idx` (`city`, `state`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
