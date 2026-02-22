/**
 * TrialBanner Component
 * Displays a banner showing days remaining in trial
 */

import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';

interface TrialBannerProps {
  daysRemaining: number;
  onUpgradePress?: () => void;
}

const SELLER_PHONE = '+639623108957';

const TrialBanner: React.FC<TrialBannerProps> = ({ daysRemaining, onUpgradePress }) => {
  const theme = useTheme();

  const handleUpgrade = () => {
    if (onUpgradePress) {
      onUpgradePress();
    } else {
      // Open WhatsApp to contact seller
      const message = encodeURIComponent('Hi! I would like to upgrade my IgoroTech POS trial to a full license.');
      Linking.openURL(`https://wa.me/${SELLER_PHONE.replace('+', '')}?text=${message}`);
    }
  };

  // Determine urgency level for styling
  const isUrgent = daysRemaining <= 7;
  const isCritical = daysRemaining <= 3;

  const bannerColor = isCritical ? '#D32F2F' : isUrgent ? '#F57C00' : '#1976D2';

  return (
    <View style={[styles.container, { backgroundColor: bannerColor }]}>
      <View style={styles.content}>
        <Text style={styles.text}>
          {daysRemaining === 1
            ? 'Trial: 1 day remaining'
            : `Trial: ${daysRemaining} days remaining`}
        </Text>
        <Button
          mode="contained"
          onPress={handleUpgrade}
          compact
          style={styles.button}
          labelStyle={styles.buttonLabel}
          buttonColor="#FFFFFF"
          textColor={bannerColor}
        >
          Upgrade
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  button: {
    marginLeft: 8,
    elevation: 0,
  },
  buttonLabel: {
    fontSize: 12,
    marginVertical: 0,
  },
});

export default TrialBanner;
